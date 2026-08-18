import { describe, expect, it } from 'bun:test';
import {
  createScheduleReminderKey,
  getReminderDate,
  parseScheduleReminders,
} from '@/lib/schedule-reminders';

describe('schedule reminder preferences', () => {
  it('creates a stable weekly key independent of accents and case', () => {
    expect(createScheduleReminderKey('Clémentine', 'Tuesday', '12:00')).toBe(
      'clementine|tuesday|12:00'
    );
  });

  it('parses valid persisted preferences and rejects malformed data', () => {
    const valid = JSON.stringify([
      {
        key: 'test|tuesday|12:00',
        name: 'Test',
        showDay: 'Tuesday',
        showTime: '12:00',
        leadMinutes: 10,
      },
    ]);

    expect(parseScheduleReminders(valid)).toHaveLength(1);
    expect(parseScheduleReminders('not-json')).toEqual([]);
    expect(parseScheduleReminders([{ nope: true }])).toEqual([]);
    expect(
      parseScheduleReminders([
        { name: 'Invalid', showDay: 'Tuesday', showTime: '99:99', leadMinutes: 10 },
      ])
    ).toEqual([]);
  });

  it('rebuilds stale persisted keys from the preference fields', () => {
    const [reminder] = parseScheduleReminders([
      {
        key: 'stale-key',
        name: 'Clémentine',
        showDay: 'Tuesday',
        showTime: '12:00',
        leadMinutes: 10,
      },
    ]);

    expect(reminder.key).toBe('clementine|tuesday|12:00');
  });

  it('calculates the reminder instant in London time', () => {
    const reminder = getReminderDate('2026-08-18', '13:00', 10);
    expect(reminder?.toISOString()).toBe('2026-08-18T11:50:00.000Z');
  });
});
