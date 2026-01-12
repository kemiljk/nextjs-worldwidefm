import { describe, it, expect } from 'bun:test';
import { parseDurationToSeconds } from '@/lib/schedule-service';

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
