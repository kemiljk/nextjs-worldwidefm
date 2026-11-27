import { afterAll, beforeAll, describe, expect, it, mock, setSystemTime } from 'bun:test';

mock.module('server-only', () => ({}));

type Query = Record<string, unknown>;
let scheduleBlocks: Record<string, unknown> = {};
let episodes: Record<string, unknown>[] = [];

mock.module('@/lib/cosmic-public', () => ({
  getPublicObject: async () => ({ object: null }),
  getPublicObjects: async (query: Query) => {
    if (query.type === 'schedule') {
      const objects = [{ id: 'schedule-1', metadata: scheduleBlocks }];
      return { objects, total: objects.length };
    }
    const dates = (query['metadata.broadcast_date'] as { $in: string[] }).$in;
    const objects = episodes.filter(episode =>
      dates.includes((episode.metadata as { broadcast_date: string }).broadcast_date)
    );
    return { objects, total: objects.length };
  },
}));

const { getWeeklySchedule } = await import('@/lib/schedule-service');

const episode = (date: string, time: string, title: string) => ({
  id: `id-${title}`,
  type: 'episode',
  slug: title.toLowerCase().replace(/\W+/g, '-'),
  title,
  created_at: '2026-11-01T00:00:00.000Z',
  modified_at: '2026-11-01T00:00:00.000Z',
  metadata: {
    broadcast_date: date,
    broadcast_time: time,
    duration: '1',
    genres: [],
    regular_hosts: [],
  },
});

describe('getWeeklySchedule', () => {
  beforeAll(() => {
    // Friday 27 Nov 2026, 10:00 in London (GMT).
    setSystemTime(new Date('2026-11-27T10:00:00.000Z'));
  });
  afterAll(() => setSystemTime());

  it('covers seven days starting today and sorts by date', async () => {
    scheduleBlocks = {};
    episodes = [
      episode('2026-12-02', '12:00', 'Wednesday Show'),
      episode('2026-11-27', '09:00', 'Today Show'),
      episode('2026-11-25', '12:00', 'Last Week Show'),
      episode('2026-12-04', '12:00', 'Beyond The Window'),
    ];

    const result = await getWeeklySchedule();

    expect(result.dayOrder[0]).toBe('Friday');
    expect(result.dayOrder).toHaveLength(7);
    expect(result.dayDates.Friday).toBe('2026-11-27');
    expect(result.scheduleItems.map(item => item.name)).toEqual(['Today Show', 'Wednesday Show']);
  });

  it('shows a plain-text placeholder until its show is published', async () => {
    // The Cosmic "friday" block is a weekly template: it applies to 27 Nov.
    scheduleBlocks = {
      friday: {
        show: [{ placeholder_title: ' Gilles Peterson ', broadcast_time_override: '12:00' }],
      },
    };
    episodes = [];

    const before = await getWeeklySchedule();
    expect(before.scheduleItems).toHaveLength(1);
    expect(before.scheduleItems[0]).toMatchObject({
      name: 'Gilles Peterson',
      date: '2026-11-27',
      show_time: '12:00',
      isPlaceholder: true,
      url: '',
      duration: 60,
    });

    episodes = [episode('2026-11-27', '12:00', 'Gilles Peterson')];
    const after = await getWeeklySchedule();
    expect(after.scheduleItems).toHaveLength(1);
    expect(after.scheduleItems[0]?.isPlaceholder).toBeUndefined();
    expect(after.scheduleItems[0]?.url).toBe('/episode/gilles-peterson');
  });

  it('ignores a manual entry with neither an episode nor a title', async () => {
    scheduleBlocks = { friday: { show: [{ broadcast_time_override: '12:00' }] } };
    episodes = [];

    expect((await getWeeklySchedule()).scheduleItems).toEqual([]);
  });
});
