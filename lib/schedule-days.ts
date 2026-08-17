import { UK_WEEK_DAYS, type UkWeekday } from './date-utils';
import type { ScheduleShow } from './types/schedule';

export const REGULAR_SCHEDULE_DAYS: UkWeekday[] = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function getVisibleScheduleDays(scheduleItems: ScheduleShow[]): UkWeekday[] {
  const scheduledDays = new Set(scheduleItems.map(show => show.show_day));

  return UK_WEEK_DAYS.filter(day => REGULAR_SCHEDULE_DAYS.includes(day) || scheduledDays.has(day));
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
  const manuallyScheduledShows = new Set(
    manualOverrides.filter(item => item.name !== 'Untitled').map(item => item.show_key)
  );
  const occupiedManualSlots = new Set(
    manualOverrides
      .filter(item => item.name !== 'Untitled')
      .map(item => `${item.date}-${item.show_time}`)
  );

  for (const item of manualOverrides) {
    if (item.name !== 'Untitled') {
      itemsBySlot.set(item.event_id || item.show_key, item);
    }
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

  return Array.from(itemsBySlot.values());
}
