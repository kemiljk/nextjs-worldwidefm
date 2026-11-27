import { describe, expect, it } from 'bun:test';
import { appendTitleDate, stripEpisodeTitleDates, stripTitleDate } from '@/lib/episode-title';

describe('stripTitleDate with the broadcast date', () => {
  it.each([
    ['Luke Una – 06.10.2026', 'Luke Una'],
    ['Luke Una - 06/10/2026', 'Luke Una'],
    ['Luke Una // 06-10-2026', 'Luke Una'],
    ['Luke Una | 6.10.26', 'Luke Una'],
    ['Luke Una (06.10.2026)', 'Luke Una'],
    ['Luke Una [06.10.2026]', 'Luke Una'],
    ['Luke Una 06.10.2026', 'Luke Una'],
    ['Luke Una – 2026-10-06', 'Luke Una'],
    ['Luke Una, 6 Oct 2026', 'Luke Una'],
    ['Luke Una – 6th October 2026', 'Luke Una'],
    ['Gilles Peterson: Live From Somewhere – 06.10.2026', 'Gilles Peterson: Live From Somewhere'],
  ])('%s → %s', (title, expected) => {
    expect(stripTitleDate(title, '2026-10-06')).toBe(expected);
  });

  it('leaves a different date alone: it may be part of the show name', () => {
    expect(stripTitleDate('Christmas Special – 24.12.2025', '2026-10-06')).toBe(
      'Christmas Special – 24.12.2025'
    );
  });

  it('leaves titles without a trailing date alone', () => {
    for (const title of [
      'Luke Una',
      '24.12.2025 Christmas Special',
      'Live from Sónar 2026',
      'Radio 4 – Vol. 12',
      'Show 99.99.9999',
    ]) {
      expect(stripTitleDate(title, '2026-10-06')).toBe(title);
    }
  });

  it('never reduces a title to nothing', () => {
    expect(stripTitleDate('06.10.2026', '2026-10-06')).toBe('06.10.2026');
    expect(stripTitleDate('– 06.10.2026', '2026-10-06')).toBe('– 06.10.2026');
  });
});

describe('stripTitleDate without the broadcast date', () => {
  it('only removes a clearly delimited date', () => {
    expect(stripTitleDate('Luke Una – 06.10.2026')).toBe('Luke Una');
    expect(stripTitleDate('Luke Una (06.10.2026)')).toBe('Luke Una');
    expect(stripTitleDate('Luke Una // 6 Oct 2026')).toBe('Luke Una');
  });

  it('keeps a title where the date is only space-separated', () => {
    expect(stripTitleDate('Luke Una 06.10.2026')).toBe('Luke Una 06.10.2026');
  });

  it('rejects impossible dates', () => {
    expect(stripTitleDate('Luke Una – 31.02.2026')).toBe('Luke Una – 31.02.2026');
    expect(stripTitleDate('Luke Una – 06.13.2026')).toBe('Luke Una – 06.13.2026');
  });
});

describe('stripEpisodeTitleDates', () => {
  it('cleans episodes at any depth and leaves other content alone', () => {
    const response = {
      objects: [
        {
          type: 'episode',
          title: 'Luke Una – 06.10.2026',
          metadata: {
            broadcast_date: '2026-10-06',
            regular_hosts: [{ type: 'regular-hosts', title: 'Luke Una – 06.10.2026' }],
          },
        },
        { type: 'posts', title: 'Event – 06.10.2026' },
        {
          type: 'sections',
          title: 'Staff picks',
          metadata: {
            items: [
              {
                type: 'episode',
                title: 'Miss Mash – 07.10.2026',
                metadata: { broadcast_date: '2026-10-07' },
              },
            ],
          },
        },
      ],
    };

    stripEpisodeTitleDates(response);

    expect(response.objects[0].title).toBe('Luke Una');
    // Not an episode: untouched.
    expect(response.objects[0].metadata?.regular_hosts?.[0].title).toBe('Luke Una – 06.10.2026');
    expect(response.objects[1].title).toBe('Event – 06.10.2026');
    expect((response.objects[2] as any).metadata.items[0].title).toBe('Miss Mash');
  });

  it('uses the query type when the response leaves type out of the props', () => {
    const response = { objects: [{ title: 'Luke Una – 06.10.2026' }] };
    stripEpisodeTitleDates(response, 'episode');
    expect(response.objects[0].title).toBe('Luke Una');

    const other = { objects: [{ title: 'Luke Una – 06.10.2026' }] };
    stripEpisodeTitleDates(other, 'posts');
    expect(other.objects[0].title).toBe('Luke Una – 06.10.2026');
  });

  it('handles single-object results and non-objects', () => {
    const one = { object: { type: 'episode', title: 'A – 06.10.2026' } };
    stripEpisodeTitleDates(one);
    expect(one.object.title).toBe('A');
    expect(stripEpisodeTitleDates(null)).toBeNull();
    expect(stripEpisodeTitleDates('text')).toBe('text');
  });
});

describe('appendTitleDate', () => {
  it('adds the broadcast date in UK order', () => {
    expect(appendTitleDate('Luke Una', '2026-10-06')).toBe('Luke Una – 06.10.2026');
    expect(appendTitleDate('  Luke Una ', '2026-01-02T18:00:00Z')).toBe('Luke Una – 02.01.2026');
  });

  it('leaves titles that already carry the date, in any format', () => {
    expect(appendTitleDate('Luke Una – 06.10.2026', '2026-10-06')).toBe('Luke Una – 06.10.2026');
    expect(appendTitleDate('Luke Una (6 Oct 2026)', '2026-10-06')).toBe('Luke Una (6 Oct 2026)');
  });

  it('adds the real date when the title ends in a different one', () => {
    expect(appendTitleDate('Christmas Special – 24.12.2025', '2026-10-06')).toBe(
      'Christmas Special – 24.12.2025 – 06.10.2026'
    );
  });

  it('does nothing without a valid broadcast date', () => {
    expect(appendTitleDate('Luke Una', undefined)).toBe('Luke Una');
    expect(appendTitleDate('Luke Una', 'tomorrow')).toBe('Luke Una');
    expect(appendTitleDate('Luke Una', '2026-13-40')).toBe('Luke Una');
  });

  it('round-trips with stripTitleDate', () => {
    const dated = appendTitleDate('Gilles Peterson: Live', '2026-11-27');
    expect(stripTitleDate(dated, '2026-11-27')).toBe('Gilles Peterson: Live');
  });
});
