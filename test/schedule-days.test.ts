import { describe, expect, it } from 'bun:test';
import {
  getScheduleEventId,
  getVisibleScheduleDays,
  mergeScheduleItems,
} from '@/lib/schedule-days';
import type { ScheduleShow } from '@/lib/types/schedule';

const makeShow = (show_day: ScheduleShow['show_day']): ScheduleShow => ({
  show_key: `show-${show_day}`,
  event_id: `event-${show_day}`,
  show_time: '12:00',
  show_day,
  date: '2026-08-17',
  name: `${show_day} show`,
  url: '',
  picture: '',
  created_time: '2026-08-17T00:00:00.000Z',
  tags: [],
  hosts: [],
  duration: 60,
});

describe('getVisibleScheduleDays', () => {
  it('keeps regular Tuesday-Friday schedule days visible', () => {
    expect(getVisibleScheduleDays([])).toEqual(['Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  });

  it('adds non-regular days only when they contain scheduled shows', () => {
    expect(getVisibleScheduleDays([makeShow('Monday'), makeShow('Saturday')])).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
  });

  it('keeps separate slots for the same episode', () => {
    expect(getScheduleEventId('episode-1', '2026-08-21', '12:00', 'Show')).not.toBe(
      getScheduleEventId('episode-1', '2026-08-22', '12:00', 'Show')
    );
  });

  it('keeps manual repeat slots while suppressing the automatic copy', () => {
    const fridayManual = { ...makeShow('Friday'), show_key: 'shared-episode', isManual: true };
    const saturdayManual = {
      ...makeShow('Saturday'),
      show_key: 'shared-episode',
      isManual: true,
    };
    const automatic = { ...makeShow('Friday'), show_key: 'shared-episode', isManual: false };

    expect(mergeScheduleItems([fridayManual, saturdayManual], [automatic])).toEqual([
      fridayManual,
      saturdayManual,
    ]);
  });

  it('keeps only the most recently modified automatic episode in a broadcast slot', () => {
    const older = {
      ...makeShow('Saturday'),
      show_key: 'older-episode',
      event_id: 'older-event',
      modified_time: '2026-08-01T12:00:00.000Z',
    };
    const newer = {
      ...makeShow('Saturday'),
      show_key: 'newer-episode',
      event_id: 'newer-event',
      modified_time: '2026-08-12T12:00:00.000Z',
    };

    expect(mergeScheduleItems([], [older, newer])).toEqual([newer]);
  });
});

describe('plain-text placeholders', () => {
  const placeholder = {
    ...makeShow('Thursday'),
    show_key: 'schedule-TBC-2026-08-17-12:00',
    event_id: 'schedule-2026-08-17-12:00-TBC',
    name: 'Gilles Peterson (TBC)',
    isManual: true,
    isPlaceholder: true,
  };
  const published = {
    ...makeShow('Thursday'),
    show_key: 'gilles-peterson-17-08-2026',
    event_id: 'episode-1-2026-08-17-12:00',
    name: 'Gilles Peterson',
  };

  it('stays on the schedule until a show is published for the slot', () => {
    expect(mergeScheduleItems([placeholder], [])).toEqual([placeholder]);
  });

  it('is replaced by the published episode in the same slot', () => {
    expect(mergeScheduleItems([placeholder], [published])).toEqual([published]);
  });

  it('is replaced when the episode starts later inside the placeholder slot', () => {
    const late = { ...published, show_time: '12:30' };
    expect(mergeScheduleItems([placeholder], [late])).toEqual([late]);
  });

  it('is kept when the published show is on another day or after the slot ends', () => {
    const otherDay = { ...published, date: '2026-08-18', event_id: 'other-day' };
    const afterSlot = { ...published, show_time: '13:00', event_id: 'after-slot' };
    const merged = mergeScheduleItems([placeholder], [otherDay, afterSlot]);
    expect(merged).toHaveLength(3);
    expect(merged).toContain(placeholder);
  });

  it('does not block an automatic episode the way a linked manual entry does', () => {
    const linked = { ...placeholder, isPlaceholder: false, name: 'Linked show' };
    expect(mergeScheduleItems([linked], [published])).toEqual([linked]);
    expect(mergeScheduleItems([placeholder], [published])).not.toContain(placeholder);
  });
});

describe('getVisibleScheduleDays with a rolling window', () => {
  it('follows the day order it is given, starting today', () => {
    const order = [
      'Friday',
      'Saturday',
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
    ] as const;
    expect(getVisibleScheduleDays([], [...order])).toEqual([
      'Friday',
      'Tuesday',
      'Wednesday',
      'Thursday',
    ]);
    expect(getVisibleScheduleDays([makeShow('Sunday')], [...order])).toEqual([
      'Friday',
      'Sunday',
      'Tuesday',
      'Wednesday',
      'Thursday',
    ]);
  });
});
