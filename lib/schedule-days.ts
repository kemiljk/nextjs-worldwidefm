import { UK_WEEK_DAYS, type UkWeekday } from './date-utils';
import type { ScheduleShow } from './types/schedule';

export const DEFAULT_PLACEHOLDER_MINUTES = 60;

export const REGULAR_SCHEDULE_DAYS: UkWeekday[] = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Days to render, in order. Pass the rolling window's day order so the page
 * starts on today; the default is the calendar week, Monday first.
 */
export function getVisibleScheduleDays(
  scheduleItems: ScheduleShow[],
  dayOrder: UkWeekday[] = UK_WEEK_DAYS
): UkWeekday[] {
  const scheduledDays = new Set(scheduleItems.map(show => show.show_day));

  return dayOrder.filter(day => REGULAR_SCHEDULE_DAYS.includes(day) || scheduledDays.has(day));
}

/** Minutes after midnight for an "HH:mm" time, or null when it can't be read. */
function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * A plain-text placeholder holds a slot until its show is published. It is
 * replaced when a published episode starts on the same date inside the
 * placeholder's slot (from its start time up to, not including, its end).
 */
function isReplacedByEpisode(placeholder: ScheduleShow, episodes: ScheduleShow[]): boolean {
  const start = minutesOfDay(placeholder.show_time);
  if (start === null) return false;
  const length = placeholder.duration > 0 ? placeholder.duration : DEFAULT_PLACEHOLDER_MINUTES;

  return episodes.some(episode => {
    if (episode.date !== placeholder.date || episode.name === 'Untitled') return false;
    const episodeStart = minutesOfDay(episode.show_time);
    return episodeStart !== null && episodeStart >= start && episodeStart < start + length;
  });
}

export function getScheduleEventId(
  episodeId: string | undefined,
  date: string,
  time: string,
  title: string
): string {
  return episodeId ? `episode-${episodeId}-${date}-${time}` : `schedule-${date}-${time}-${title}`;
}

export function mergeScheduleItems(
  manualOverrides: ScheduleShow[],
  automaticEpisodes: ScheduleShow[]
): ScheduleShow[] {
  const itemsBySlot = new Map<string, ScheduleShow>();
  // Placeholders never claim a slot: a published episode takes their place.
  const lockingOverrides = manualOverrides.filter(
    item => item.name !== 'Untitled' && !item.isPlaceholder
  );
  const placeholders = manualOverrides.filter(
    item => item.name !== 'Untitled' && item.isPlaceholder
  );
  const manuallyScheduledShows = new Set(lockingOverrides.map(item => item.show_key));
  const occupiedManualSlots = new Set(
    lockingOverrides.map(item => `${item.date}-${item.show_time}`)
  );

  for (const item of lockingOverrides) {
    itemsBySlot.set(item.event_id || item.show_key, item);
  }

  const automaticBySlot = new Map<string, ScheduleShow>();
  for (const item of automaticEpisodes) {
    const slotKey = `${item.date}-${item.show_time}`;
    if (
      item.name === 'Untitled' ||
      manuallyScheduledShows.has(item.show_key) ||
      occupiedManualSlots.has(slotKey)
    ) {
      continue;
    }

    const current = automaticBySlot.get(slotKey);
    const itemModifiedAt = Date.parse(item.modified_time || item.created_time);
    const currentModifiedAt = current
      ? Date.parse(current.modified_time || current.created_time)
      : Number.NEGATIVE_INFINITY;

    if (!current || itemModifiedAt > currentModifiedAt) {
      automaticBySlot.set(slotKey, item);
    }
  }

  for (const item of automaticBySlot.values()) {
    itemsBySlot.set(item.event_id || item.show_key, item);
  }

  const publishedEpisodes = [...automaticBySlot.values(), ...lockingOverrides];
  for (const placeholder of placeholders) {
    if (!isReplacedByEpisode(placeholder, publishedEpisodes)) {
      itemsBySlot.set(placeholder.event_id || placeholder.show_key, placeholder);
    }
  }

  return Array.from(itemsBySlot.values());
}
