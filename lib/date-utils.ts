/**
 * Date utility functions for handling broadcast dates
 * Supports both old format (ISO strings) and new format (YYYY-MM-DD + HH:MM)
 */

const LONDON_TZ = 'Europe/London';

const londonWallClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function getLondonWallClockParts(ms: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = londonWallClockFormatter.formatToParts(new Date(ms));
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value ?? NaN);
  return {
    year: n('year'),
    month: n('month'),
    day: n('day'),
    hour: n('hour'),
    minute: n('minute'),
    second: n('second'),
  };
}

function londonWallClockMatches(
  p: ReturnType<typeof getLondonWallClockParts>,
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number
): boolean {
  return (
    p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi && p.second === s
  );
}

/**
 * Interpret YYYY-MM-DD and HH:MM as Europe/London wall-clock time and return the UTC instant.
 * Uses Intl (IANA tzdata) so GMT/BST changes are automatic.
 *
 * Implementation: a few ms-correction iterations (typically 2–4) instead of scanning every
 * second, so static generation with hundreds of pages stays fast.
 */
export function parseLondonDateTime(dateStr: string, timeStr: string): Date | null {
  const trimmedDate = dateStr.trim();
  const trimmedTime = timeStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) return null;

  const tm = trimmedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!tm) return null;

  const y = Number(trimmedDate.slice(0, 4));
  const mo = Number(trimmedDate.slice(5, 7));
  const d = Number(trimmedDate.slice(8, 10));
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  const s = Number(tm[3] ?? 0);

  if (![y, mo, d, h, mi, s].every(n => Number.isFinite(n))) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;

  let utcMs = Date.UTC(y, mo - 1, d, h, mi, s);

  for (let i = 0; i < 24; i++) {
    const p = getLondonWallClockParts(utcMs);
    if (londonWallClockMatches(p, y, mo, d, h, mi, s)) {
      return new Date(utcMs);
    }
    const want = Date.UTC(y, mo - 1, d, h, mi, s);
    const got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const nextMs = utcMs + (want - got);
    if (nextMs === utcMs) break;
    utcMs = nextMs;
  }

  const anchor = utcMs;
  for (let deltaMin = -24 * 60; deltaMin <= 24 * 60; deltaMin++) {
    const t = anchor + deltaMin * 60_000;
    const p = getLondonWallClockParts(t);
    if (londonWallClockMatches(p, y, mo, d, h, mi, s)) {
      return new Date(t);
    }
  }

  return null;
}

/**
 * Parse broadcast date and time into a Date object
 * Handles both old format (ISO string) and new format (date + time)
 * Also checks broadcast_date_old as fallback during migration
 * @param broadcast_date - Either "2025-09-04T07:00:00+00:00" (old) or "2025-09-04" (new)
 * @param broadcast_time - "HH:MM" format (e.g., "13:30"), Europe/London wall time when used with date-only broadcast_date
 * @param broadcast_date_old - Fallback field during migration
 * @returns UTC Date for the instant, or null
 */
export function parseBroadcastDateTime(
  broadcast_date: string | null | undefined,
  broadcast_time: string | null | undefined = null,
  broadcast_date_old: string | null | undefined = null
): Date | null {
  // Try broadcast_date first, fallback to broadcast_date_old during migration
  const dateToUse = broadcast_date || broadcast_date_old;

  if (!dateToUse) return null;

  // Handle old format (full ISO string)
  if (dateToUse.includes('T')) {
    return new Date(dateToUse);
  }

  // Handle new format (YYYY-MM-DD + HH:MM) as Europe/London wall clock
  const time = broadcast_time || '00:00';
  return parseLondonDateTime(dateToUse, time);
}

/**
 * Convert broadcast date and time to ISO string for RadioCult API
 * Works with both old and new formats
 * Also checks broadcast_date_old as fallback during migration
 */
export function broadcastToISOString(
  broadcast_date: string | null | undefined,
  broadcast_time: string | null | undefined = null,
  broadcast_date_old: string | null | undefined = null
): string | null {
  const date = parseBroadcastDateTime(broadcast_date, broadcast_time, broadcast_date_old);
  return date ? date.toISOString() : null;
}

/**
 * Extract date part only (YYYY-MM-DD) from any date format
 */
export function extractDatePart(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // If ISO string, extract date part
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
}

/**
 * Extract time part (HH:MM) from any date format
 */
export function extractTimePart(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  // If it's an ISO string, extract time
  if (dateString.includes('T')) {
    try {
      return new Date(dateString).toISOString().substring(11, 16);
    } catch (error) {
      console.error('Error extracting time:', dateString, error);
      return null;
    }
  }

  return null;
}

/**
 * Parse duration string to minutes
 * Handles formats:
 * - "H:MM" (e.g., "1:45" -> 105)
 * - "H:MM:SS" (e.g., "1:45:00" -> 105)
 * - "M" (e.g., "60" -> 60)
 * - "H" (e.g., "2" where intent is hours -> 2 hours if treated as such elsewhere, but checking context)
 *
 * NOTE: Previously the system expected duration in minutes as a string "60".
 * The new system might send "1:00" for 1 hour.
 */
export function parseDurationToMinutes(duration: string | number | null | undefined): number {
  if (!duration) return 0;

  const durationStr = duration.toString();

  // Handle colon format (H:MM or H:MM:SS)
  if (durationStr.includes(':')) {
    const parts = durationStr.split(':').map(Number);
    // H:MM or H:MM:SS
    if (parts.length >= 2) {
      const hours = parts[0] || 0;
      const minutes = parts[1] || 0;
      return hours * 60 + minutes;
    }
  }

  // Handle plain number (legacy minutes)
  const parsed = parseInt(durationStr, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get the UK timezone abbreviation (BST or GMT) for a given date
 * BST is British Summer Time (UTC+1), GMT is Greenwich Mean Time (UTC+0)
 * @param date - The date to check (defaults to current date)
 * @returns The timezone abbreviation with brackets, e.g., "[BST]" or "[GMT]"
 */
export function getUKTimezoneAbbreviation(date: Date = new Date()): string {
  // Validate date - check if it's a valid, finite date
  if (!(date instanceof Date) || isNaN(date.getTime()) || !isFinite(date.getTime())) {
    return '[GMT]';
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(part => part.type === 'timeZoneName');

    return tzPart ? `[${tzPart.value}]` : '[GMT]';
  } catch (error) {
    console.error('Error formatting timezone abbreviation:', error);
    return '[GMT]';
  }
}

/**
 * Format a London-local broadcast instant for display (24h + [GMT]/[BST]).
 */
export function formatLondonBroadcastTime(date: Date): string {
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: LONDON_TZ,
    hour12: false,
  });
  return `${time} ${getUKTimezoneAbbreviation(date)}`;
}

export type UkWeekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export const UK_WEEK_DAYS: UkWeekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface UkWeekInfo {
  startOfWeek: Date;
  dayDates: Record<UkWeekday, string>;
}

/**
 * Create a Date instance that represents the provided timestamp in the supplied timezone.
 */
function getDateInTimeZone(date: Date, timeZone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value ?? '0');

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
}

function startOfUkWeek(date: Date): Date {
  const current = new Date(date);
  const day = current.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const daysSinceMonday = (day + 6) % 7;
  current.setUTCDate(current.getUTCDate() - daysSinceMonday);
  current.setUTCHours(0, 0, 0, 0);
  return current;
}

/**
 * Get the current UK week (Monday -> Sunday) based on the Europe/London timezone.
 * If it's Saturday or Sunday, it returns the dates for the following week.
 */
export function getCurrentUkWeek(referenceDate: Date = new Date()): UkWeekInfo {
  const londonDate = getDateInTimeZone(referenceDate, 'Europe/London');

  // If it's Saturday (6) or Sunday (0), move the reference to next week
  // so we show the upcoming schedule instead of the one that just finished.
  const dayOfWeek = londonDate.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    londonDate.setUTCDate(londonDate.getUTCDate() + 7);
  }

  const weekStart = startOfUkWeek(londonDate);

  const dayDates = {} as Record<UkWeekday, string>;
  UK_WEEK_DAYS.forEach((day, index) => {
    const current = new Date(weekStart);
    current.setUTCDate(weekStart.getUTCDate() + index);
    dayDates[day] = current.toISOString().slice(0, 10);
  });

  return {
    startOfWeek: weekStart,
    dayDates,
  };
}
