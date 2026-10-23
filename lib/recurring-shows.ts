import type { UkWeekday } from './date-utils';
import { plainTextToHtml } from './text-to-html';

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
}

export interface RecurringHostMetadata {
  description?: string | null;
  image?: { url?: string | null; imgix_url?: string | null } | null;
  external_image_url?: string | null;
}

/** Episode main text (`body_text`) from the host's Cosmic description, else the template copy. */
export function getRecurringEpisodeBody(
  template: Pick<RecurringShowTemplate, 'description'>,
  hostMetadata?: RecurringHostMetadata | null
): string {
  return plainTextToHtml(hostMetadata?.description?.trim() || template.description);
}

/** Image URLs the old weekly job copied from the host into `external_image_url`. */
export function hostImageUrls(hostMetadata?: RecurringHostMetadata | null): string[] {
  return [
    hostMetadata?.external_image_url,
    hostMetadata?.image?.imgix_url,
    hostMetadata?.image?.url,
  ].filter((url): url is string => Boolean(url));
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
  },
  {
    title: 'First Light',
    hostSlug: 'rohan-rakhit',
    day: 'Tuesday',
    startTime: '10:00',
    durationHours: 2,
    description:
      'Rohan Rakhit presents First Light — a mid-morning journey through soul, jazz, and beyond on Worldwide FM.',
  },
  {
    title: 'Worldwide Breakfast',
    hostSlug: 'valentine-comar',
    day: 'Wednesday',
    startTime: '08:00',
    durationHours: 2,
    description:
      'Valentine Comar presents Worldwide Breakfast on Worldwide FM — your Wednesday morning soundtrack. Audio, genres, and tracklist to be added after the live show.',
  },
  {
    title: 'Alfie Panaiotis',
    hostSlug: 'alfie-panaiotis',
    day: 'Wednesday',
    startTime: '10:00',
    durationHours: 2,
    description:
      'Alfie Panaiotis on Worldwide FM — mid-morning selections. Audio, genres, and tracklist to be added after the live show.',
  },
  {
    title: 'Gilles Peterson',
    hostSlug: 'gilles-peterson',
    day: 'Thursday',
    startTime: '08:00',
    durationHours: 4,
    description:
      'Gilles Peterson on Worldwide FM — four hours of music discovery every Thursday morning.',
  },
  {
    title: 'Shai Space',
    hostSlug: 'shai-space',
    day: 'Friday',
    startTime: '08:00',
    durationHours: 2,
    description:
      'Shai Space on Worldwide FM — Friday morning vibes. Audio, genres, and tracklist to be added after the live show.',
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
