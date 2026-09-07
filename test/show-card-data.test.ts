import { expect, test } from 'bun:test';
import { toShowCardData } from '../lib/show-card-data';

test('card projection preserves navigation, London time, artwork, taxonomy and playback', () => {
  const result = toShowCardData({
    id: 'episode-id',
    slug: 'show',
    title: 'Show: Guest',
    type: 'episode',
    metadata: {
      player: '/worldwidefm/show/',
      broadcast_date: '2026-07-20',
      broadcast_time: '12:00',
      external_image_url: 'https://example.com/image.jpg',
      genres: [{ id: 'jazz', slug: 'jazz', title: 'Jazz', metadata: { body: 'huge' } }],
      regular_hosts: [{ id: 'host', title: 'Host', metadata: { biography: 'huge' } }],
      locations: [{ id: 'london', title: 'London' }],
      body_text: 'huge',
      tracklist: 'huge',
      description: 'huge',
    },
  });
  expect(result.url).toBe('https://www.mixcloud.com/worldwidefm/show/');
  expect(result.key).toBe('show');
  expect(result.created_time).toBe('2026-07-20T11:00:00.000Z');
  expect(result.metadata.external_image_url).toBe('https://example.com/image.jpg');
  expect(result.user.name).toBe('Host');
  expect(result.metadata.genres).toEqual([{ id: 'jazz', slug: 'jazz', title: 'Jazz' }]);
  expect(JSON.stringify(result)).not.toContain('huge');
});

test('preserves absolute playback URLs and tolerates missing optional metadata', () => {
  const result = toShowCardData({
    id: 'a',
    slug: 'a',
    name: 'Legacy show',
    url: 'https://soundcloud.com/example/show',
  });
  expect(result.url).toBe('https://soundcloud.com/example/show');
  expect(result.name).toBe('Legacy show');
  expect(result.metadata.genres).toEqual([]);
  expect(result.metadata.external_image_url).toBe('/image-placeholder.png');
});
