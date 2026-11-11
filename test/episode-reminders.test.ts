import { describe, expect, it } from 'bun:test';
import {
  episodeStartTime,
  getEpisodeReminderDelay,
  parseEpisodeReminderIds,
} from '@/lib/episode-reminders';

describe('one-off episode reminders', () => {
  it('stores only unique, valid episode IDs from Cosmic JSON', () => {
    expect(parseEpisodeReminderIds('["one", "two", "one", "../invalid", 7]')).toEqual([
      'one',
      'two',
    ]);
    expect(parseEpisodeReminderIds('invalid JSON')).toEqual([]);
  });

  it('interprets show times in London and requires an actual time', () => {
    expect(
      episodeStartTime({ broadcast_date: '2026-07-15', broadcast_time: '10:00' })?.toISOString()
    ).toBe('2026-07-15T09:00:00.000Z');
    expect(episodeStartTime({ broadcast_date: '2026-07-15' })).toBeNull();
    expect(episodeStartTime({ broadcast_date: '2026-07-15T10:00:00Z' })?.toISOString()).toBe(
      '2026-07-15T10:00:00.000Z'
    );
  });

  it('schedules ten minutes before a show or immediately within that window', () => {
    expect(getEpisodeReminderDelay(1_800_000, 0)).toBe(1_200_000);
    expect(getEpisodeReminderDelay(300_000, 0)).toBe(0);
    expect(getEpisodeReminderDelay(0, 0)).toBeNull();
    expect(getEpisodeReminderDelay(3_000_000_000, 0)).toBeNull();
  });
});
