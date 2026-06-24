import { describe, it, expect } from 'bun:test';
import {
  buildRecurringEpisodeSlug,
  RECURRING_SHOWS,
  RECURRING_SHOW_PLACEHOLDER_IMAGE,
  slugifyRecurringTitle,
} from '@/lib/recurring-shows';

describe('recurring-shows', () => {
  it('defines six weekly show templates', () => {
    expect(RECURRING_SHOWS).toHaveLength(6);
  });

  it('uses the site placeholder image for all templates', () => {
    for (const show of RECURRING_SHOWS) {
      expect(show.placeholderImageUrl).toBe(RECURRING_SHOW_PLACEHOLDER_IMAGE);
    }
  });

  it('slugifies titles consistently', () => {
    expect(slugifyRecurringTitle('Breakfast Club Coco')).toBe('breakfast-club-coco');
    expect(slugifyRecurringTitle('First Light')).toBe('first-light');
  });

  it('builds deterministic episode slugs from title and date', () => {
    expect(buildRecurringEpisodeSlug('First Light', '2026-06-24')).toBe(
      'first-light-2026-06-24'
    );
  });

  it('links Worldwide Breakfast to Valentine Comar in Cosmic', () => {
    const worldwideBreakfast = RECURRING_SHOWS.find(show => show.title === 'Worldwide Breakfast');
    expect(worldwideBreakfast?.hostSlug).toBe('valentine-comar');
    expect(worldwideBreakfast?.day).toBe('Wednesday');
    expect(worldwideBreakfast?.startTime).toBe('08:00');
  });
});
