import { describe, expect, it } from 'bun:test';
import {
  buildMixcloudDescription,
  buildMixcloudTags,
  formatDateForMixcloud,
} from '@/lib/upload-master-metadata';
import type { EpisodeObject } from '@/lib/cosmic-types';

const SHOW_PAGE_URL = 'https://worldwidefm.net/episode/test-episode';

function makeEpisode(metadata: Record<string, unknown>): EpisodeObject {
  return { metadata } as unknown as EpisodeObject;
}

describe('buildMixcloudDescription', () => {
  it('labels the show page link as the tracklist', () => {
    const description = buildMixcloudDescription(
      makeEpisode({ description: 'Two hours of deep house.' }),
      SHOW_PAGE_URL
    );

    expect(description).toBe(`Two hours of deep house.\n\nTracklist: ${SHOW_PAGE_URL}`);
    expect(description).not.toContain('Full show');
  });

  it('includes the tracklist link without appending the episode tracklist', () => {
    const description = buildMixcloudDescription(
      makeEpisode({
        body_text: '<p>Show copy</p>',
        tracklist: '1. Artist - Track<br />2. Other Artist - Other Track',
      }),
      SHOW_PAGE_URL
    );

    expect(description).toBe(`Show copy\n\nTracklist: ${SHOW_PAGE_URL}`);
  });

  it('uses the label once, not once per section', () => {
    const description = buildMixcloudDescription(
      makeEpisode({ description: 'Copy', tracklist: '1. Artist - Track' }),
      SHOW_PAGE_URL
    );

    expect(description.match(/Tracklist:/g)).toHaveLength(1);
  });

  it('strips a tracklist pasted into the show copy under a heading', () => {
    const description = buildMixcloudDescription(
      makeEpisode({
        body_text:
          '<p>Two hours of deep house.</p><p>Tracklist</p><p>Artist - Track</p><p>Other - Song</p>',
      }),
      SHOW_PAGE_URL
    );

    expect(description).toBe(`Two hours of deep house.\n\nTracklist: ${SHOW_PAGE_URL}`);
  });

  it('strips an unlabelled run of track lines but keeps copy with a single dash', () => {
    const description = buildMixcloudDescription(
      makeEpisode({
        body_text:
          '<p>Live from Lisbon - a special one.</p><p>1. Artist - One</p><p>2. Band – Two</p><p>3. Duo - Three</p><p>Thanks for listening.</p>',
      }),
      SHOW_PAGE_URL
    );

    expect(description).toBe(
      `Live from Lisbon - a special one.\nThanks for listening.\n\nTracklist: ${SHOW_PAGE_URL}`
    );
  });

  it('omits the link line when there is no show page URL', () => {
    const description = buildMixcloudDescription(
      makeEpisode({ description: 'Copy', tracklist: '1. Artist - Track' }),
      ''
    );

    expect(description).toBe('Copy');
  });
});

describe('buildMixcloudTags', () => {
  it('always includes the station tag and caps at five tags', () => {
    const tags = buildMixcloudTags(
      makeEpisode({
        genres: [
          { title: 'House' },
          { title: 'Jazz' },
          { title: 'Soul' },
          { title: 'Disco' },
          { title: 'Funk' },
          { title: 'Broken Beat' },
        ],
      })
    );

    expect(tags).toHaveLength(5);
    expect(tags[0]).toBe('House');
  });
});

describe('formatDateForMixcloud', () => {
  it('renders the broadcast date as DD-MM-YY', () => {
    expect(formatDateForMixcloud('2026-07-29')).toBe('29-07-26');
  });

  it('passes through values that are not a full date', () => {
    expect(formatDateForMixcloud('2026-07')).toBe('2026-07');
  });
});
