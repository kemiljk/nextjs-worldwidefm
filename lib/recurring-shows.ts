import type { UkWeekday } from './date-utils';

export const RECURRING_SHOW_PLACEHOLDER_IMAGE = '/image-placeholder.png';

/**
 * Host slugs follow Cosmic regular-hosts slug conventions (lowercase, hyphenated).
 * Verify in Cosmic before the first cron run if any lookup warnings appear.
 */

export interface RecurringShowTemplate {
  title: string;
  hostSlug?: string;
  day: UkWeekday;
  startTime: string;
  durationHours: number;
  description: string;
  placeholderImageUrl: string;
}

export const RECURRING_SHOWS: RecurringShowTemplate[] = [
  {
    title: 'Breakfast Club Coco',
    hostSlug: 'coco-maria',
    day: 'Tuesday',
    startTime: '08:00',
    durationHours: 2,
    description:
      'Coco Maria hosts Breakfast Club on Worldwide FM — morning grooves, global sounds, and conversation to start your Tuesday.',
    placeholderImageUrl: RECURRING_SHOW_PLACEHOLDER_IMAGE,
  },
  {
    title: 'First Light',
    hostSlug: 'rohan-rakhit',
    day: 'Tuesday',
    startTime: '10:00',
    durationHours: 2,
    description:
      'Rohan Rakhit presents First Light — a mid-morning journey through soul, jazz, and beyond on Worldwide FM.',
    placeholderImageUrl: RECURRING_SHOW_PLACEHOLDER_IMAGE,
  },
  {
    title: 'Worldwide Breakfast',
    hostSlug: 'valentine-comar',
    day: 'Wednesday',
    startTime: '08:00',
    durationHours: 2,
    description:
      'Valentine Comar presents Worldwide Breakfast on Worldwide FM — your Wednesday morning soundtrack. Audio, genres, and tracklist to be added after the live show.',
    placeholderImageUrl: RECURRING_SHOW_PLACEHOLDER_IMAGE,
  },
  {
    title: 'Alfie Panaiotis',
    hostSlug: 'alfie-panaiotis',
    day: 'Wednesday',
    startTime: '10:00',
    durationHours: 2,
    description:
      'Alfie Panaiotis on Worldwide FM — mid-morning selections. Audio, genres, and tracklist to be added after the live show.',
    placeholderImageUrl: RECURRING_SHOW_PLACEHOLDER_IMAGE,
  },
  {
    title: 'Gilles Peterson',
    hostSlug: 'gilles-peterson',
    day: 'Thursday',
    startTime: '08:00',
    durationHours: 4,
    description:
      'Gilles Peterson on Worldwide FM — four hours of music discovery every Thursday morning.',
    placeholderImageUrl: RECURRING_SHOW_PLACEHOLDER_IMAGE,
  },
  {
    title: 'Shai Space',
    hostSlug: 'shai-space',
    day: 'Friday',
    startTime: '08:00',
    durationHours: 2,
    description:
      'Shai Space on Worldwide FM — Friday morning vibes. Audio, genres, and tracklist to be added after the live show.',
    placeholderImageUrl: RECURRING_SHOW_PLACEHOLDER_IMAGE,
  },
];

export function slugifyRecurringTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function buildRecurringEpisodeSlug(title: string, broadcastDate: string): string {
  return `${slugifyRecurringTitle(title)}-${broadcastDate}`;
}
