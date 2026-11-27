import { describe, it, expect } from 'bun:test';
import {
  parseBroadcastDateTime,
  parseLondonDateTime,
  formatLondonBroadcastTime,
  getCurrentUkWeek,
  getRollingUkWeek,
} from '@/lib/date-utils';

describe('parseLondonDateTime', () => {
  it('interprets winter wall time as GMT (same as UTC)', () => {
    const d = parseLondonDateTime('2025-01-15', '13:00');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2025-01-15T13:00:00.000Z');
  });

  it('interprets summer wall time as BST (UTC+1)', () => {
    const d = parseLondonDateTime('2025-07-15', '13:00');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2025-07-15T12:00:00.000Z');
  });

  it('returns null for invalid date', () => {
    expect(parseLondonDateTime('2025-13-40', '13:00')).toBeNull();
  });

  it('returns null for invalid time', () => {
    expect(parseLondonDateTime('2025-01-15', '25:00')).toBeNull();
  });
});

describe('parseBroadcastDateTime', () => {
  it('uses London wall time for YYYY-MM-DD + HH:MM', () => {
    const d = parseBroadcastDateTime('2025-07-15', '13:00');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2025-07-15T12:00:00.000Z');
  });

  it('parses full ISO as instant (unchanged semantics)', () => {
    const d = parseBroadcastDateTime('2025-07-15T12:00:00.000Z', '00:00');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2025-07-15T12:00:00.000Z');
  });
});

describe('formatLondonBroadcastTime', () => {
  it('includes time and timezone label', () => {
    const d = parseLondonDateTime('2025-07-15', '13:00')!;
    const s = formatLondonBroadcastTime(d);
    expect(s).toMatch(/^13:00 /);
    expect(s).toMatch(/\[(BST|GMT)\]$/);
  });
});

describe('getCurrentUkWeek', () => {
  it('can retain the current week when the schedule is viewed at the weekend', () => {
    const saturday = new Date('2026-08-22T12:00:00.000Z');

    expect(getCurrentUkWeek(saturday, false).dayDates.Saturday).toBe('2026-08-22');
  });
});

describe('getRollingUkWeek', () => {
  it('starts today and runs seven days, not the calendar week', () => {
    // Wednesday 2026-11-25, midday in London (GMT).
    const week = getRollingUkWeek(new Date('2026-11-25T12:00:00.000Z'));

    expect(week.orderedDays).toEqual([
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
      'Monday',
      'Tuesday',
    ]);
    expect(week.dayDates.Wednesday).toBe('2026-11-25');
    expect(week.dayDates.Sunday).toBe('2026-11-29');
    expect(week.dayDates.Monday).toBe('2026-11-30');
    expect(week.dayDates.Tuesday).toBe('2026-12-01');
  });

  it('maps every weekday to exactly one date inside the window', () => {
    const week = getRollingUkWeek(new Date('2026-11-27T09:00:00.000Z'));
    const dates = Object.values(week.dayDates);

    expect(new Set(dates).size).toBe(7);
    expect(week.orderedDays[0]).toBe('Friday');
    expect(dates.sort()[0]).toBe('2026-11-27');
    expect(dates.sort()[6]).toBe('2026-12-03');
  });

  it('uses the London date when UTC is still on the previous day', () => {
    // 23:30 UTC on 2026-06-30 is already 00:30 BST on 1 July.
    const week = getRollingUkWeek(new Date('2026-06-30T23:30:00.000Z'));

    expect(week.orderedDays[0]).toBe('Wednesday');
    expect(week.dayDates.Wednesday).toBe('2026-07-01');
  });
});
