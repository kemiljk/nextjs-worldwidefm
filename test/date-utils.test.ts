import { describe, it, expect } from 'bun:test';
import {
  parseBroadcastDateTime,
  parseLondonDateTime,
  formatLondonBroadcastTime,
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
