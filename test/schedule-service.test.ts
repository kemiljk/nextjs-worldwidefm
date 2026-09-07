import { describe, it, expect, mock } from 'bun:test';
mock.module('server-only', () => ({}));
const { parseDurationToSeconds, selectCurrentScheduleShow } = await import(
  '@/lib/schedule-service'
);
import type { ScheduleShow } from '@/lib/types/schedule';

describe('parseDurationToSeconds', () => {
  it('parses plain hours ("4") as hours', () => {
    expect(parseDurationToSeconds('4')).toBe(4 * 3600);
  });

  it('parses decimal hours ("1.5") as hours', () => {
    expect(parseDurationToSeconds('1.5')).toBe(Math.round(1.5 * 3600));
  });

  it('parses HH:MM as hours and minutes ("04:00")', () => {
    expect(parseDurationToSeconds('04:00')).toBe(4 * 3600);
  });

  it('parses HH:MM as hours and minutes ("02:30")', () => {
    expect(parseDurationToSeconds('02:30')).toBe(2 * 3600 + 30 * 60);
  });

  it('parses small minute-only numeric (>24) as minutes ("90")', () => {
    expect(parseDurationToSeconds('90')).toBe(90 * 60);
  });

  it('parses HH:MM:SS', () => {
    expect(parseDurationToSeconds('01:00:00')).toBe(3600);
  });

  it('returns 0 for null/undefined/invalid', () => {
    expect(parseDurationToSeconds(null)).toBe(0);
    expect(parseDurationToSeconds(undefined)).toBe(0);
    expect(parseDurationToSeconds('abc')).toBe(0);
  });
});

describe('current show selection', () => {
  const shows = [
    { name: 'First', date: '2026-09-07', show_time: '10:00', duration: 60, url: '/episode/first' },
    {
      name: 'Second',
      date: '2026-09-07',
      show_time: '11:00',
      duration: 60,
      url: '/episode/second',
    },
  ] as ScheduleShow[];
  it('changes programme at the London boundary without refetching content', () => {
    expect(selectCurrentScheduleShow(shows, Date.parse('2026-09-07T09:59:59Z'))?.slug).toBe(
      'first'
    );
    expect(selectCurrentScheduleShow(shows, Date.parse('2026-09-07T10:00:00Z'))?.slug).toBe(
      'second'
    );
    expect(selectCurrentScheduleShow(shows, Date.parse('2026-09-07T11:00:00Z'))).toBeNull();
  });
  it('returns an expiry and respects the winter UTC offset', () => {
    const winter = [{ ...shows[0], date: '2026-12-07' }];
    expect(selectCurrentScheduleShow(winter, Date.parse('2026-12-07T10:30:00Z'))?.endsAt).toBe(
      '2026-12-07T11:00:00.000Z'
    );
    expect(selectCurrentScheduleShow(winter, Date.parse('2026-12-07T09:30:00Z'))).toBeNull();
  });
});
