import { describe, it, expect } from 'bun:test';
import {
  buildRecurringEpisodeSlug,
  getRecurringEpisodeBody,
  hostImageUrls,
  RECURRING_SHOWS,
  slugifyRecurringTitle,
} from '@/lib/recurring-shows';
import { resolveEpisodeImage } from '@/lib/episode-image';
import { plainTextToHtml } from '@/lib/text-to-html';

describe('recurring-shows', () => {
  it('defines six weekly show templates', () => {
    expect(RECURRING_SHOWS).toHaveLength(6);
  });

  it('prefers the Cosmic host description over the template copy', () => {
    expect(
      getRecurringEpisodeBody({ description: 'Fallback' }, { description: 'Host description' })
    ).toBe('<p>Host description</p>');
    expect(getRecurringEpisodeBody({ description: 'Fallback' }, { description: '  ' })).toBe(
      '<p>Fallback</p>'
    );
  });

  it('keeps paragraphs and line breaks from plain-text copy', () => {
    expect(plainTextToHtml('First paragraph\nsecond line\n\nSecond & last')).toBe(
      '<p>First paragraph<br />second line</p><p>Second &amp; last</p>'
    );
  });

  it('leaves copy that is already HTML untouched', () => {
    expect(plainTextToHtml('<p>Already <em>rich</em></p>')).toBe('<p>Already <em>rich</em></p>');
  });

  it('lists every host image URL the old job may have copied', () => {
    expect(
      hostImageUrls({
        external_image_url: 'https://blob.example.com/host.png',
        image: { imgix_url: 'https://imgix.cosmicjs.com/host.png', url: null },
      })
    ).toEqual(['https://blob.example.com/host.png', 'https://imgix.cosmicjs.com/host.png']);
  });

  it('shows an uploaded episode image before the host image', () => {
    const host = { metadata: { external_image_url: 'https://blob.example.com/host.png' } };
    expect(resolveEpisodeImage({ regular_hosts: [host] })).toBe(
      'https://blob.example.com/host.png'
    );
    expect(
      resolveEpisodeImage({
        image: { imgix_url: 'https://imgix.cosmicjs.com/upload.jpg' },
        regular_hosts: [host],
      })
    ).toBe('https://imgix.cosmicjs.com/upload.jpg');
    expect(resolveEpisodeImage({ regular_hosts: ['host-id-only'] })).toBe('');
  });

  it('slugifies titles consistently', () => {
    expect(slugifyRecurringTitle('Breakfast Club Coco')).toBe('breakfast-club-coco');
    expect(slugifyRecurringTitle('First Light')).toBe('first-light');
  });

  it('builds deterministic episode slugs from title and date', () => {
    expect(buildRecurringEpisodeSlug('First Light', '2026-06-24')).toBe('first-light-2026-06-24');
  });

  it('links Worldwide Breakfast to Valentine Comar in Cosmic', () => {
    const worldwideBreakfast = RECURRING_SHOWS.find(show => show.title === 'Worldwide Breakfast');
    expect(worldwideBreakfast?.hostSlug).toBe('valentine-comar');
    expect(worldwideBreakfast?.day).toBe('Wednesday');
    expect(worldwideBreakfast?.startTime).toBe('08:00');
  });
});
