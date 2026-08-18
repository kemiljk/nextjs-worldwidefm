import { parseLondonDateTime, type UkWeekday } from './date-utils';
import { foldSearchText } from './search-query';
import type { ScheduleShow } from './types/schedule';

export const DEFAULT_REMINDER_LEAD_MINUTES = 10;
export const SCHEDULE_NOTIFICATIONS_STORAGE_KEY = 'wwfm-schedule-notifications';
export const SCHEDULE_NOTIFICATIONS_CHANGED_EVENT = 'wwfm-schedule-notifications-changed';

export interface ScheduleReminderPreference {
  key: string;
  name: string;
  showDay: UkWeekday;
  showTime: string;
  leadMinutes: number;
}

const WEEKDAYS = new Set<UkWeekday>([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

export function createScheduleReminderKey(
  name: string,
  showDay: UkWeekday,
  showTime: string
): string {
  return `${foldSearchText(name.trim())}|${showDay.toLowerCase()}|${showTime}`;
}

export function createScheduleReminderPreference(
  show: Pick<ScheduleShow, 'name' | 'show_day' | 'show_time'>,
  leadMinutes = DEFAULT_REMINDER_LEAD_MINUTES
): ScheduleReminderPreference {
  return {
    key: createScheduleReminderKey(show.name, show.show_day, show.show_time),
    name: show.name,
    showDay: show.show_day,
    showTime: show.show_time,
    leadMinutes,
  };
}

export function parseScheduleReminders(value: unknown): ScheduleReminderPreference[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const valid = parsed.filter(
    (item): item is Omit<ScheduleReminderPreference, 'key'> & { key?: string } => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<ScheduleReminderPreference>;
      const timeMatch =
        typeof candidate.showTime === 'string'
          ? /^(\d{2}):(\d{2})$/.exec(candidate.showTime)
          : null;
      return Boolean(
        typeof candidate.name === 'string' &&
          candidate.name.trim().length > 0 &&
          candidate.name.length <= 200 &&
          candidate.showDay &&
          WEEKDAYS.has(candidate.showDay) &&
          timeMatch &&
          Number(timeMatch[1]) < 24 &&
          Number(timeMatch[2]) < 60 &&
          typeof candidate.leadMinutes === 'number' &&
          candidate.leadMinutes >= 0 &&
          candidate.leadMinutes <= 120
      );
    }
  );

  return valid.map(candidate => ({
    ...candidate,
    key: createScheduleReminderKey(candidate.name, candidate.showDay, candidate.showTime),
  }));
}

export function getReminderDate(date: string, showTime: string, leadMinutes: number): Date | null {
  const showDate = parseLondonDateTime(date, showTime);
  if (!showDate) return null;
  return new Date(showDate.getTime() - leadMinutes * 60_000);
}
