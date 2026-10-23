import { EpisodeObject } from '@/lib/cosmic-types';

export function formatDateForMixcloud(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!d || !m || !y) return dateStr;
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y.slice(-2)}`;
}

export function buildMixcloudTags(episode: EpisodeObject): string[] {
  const tags = [...(episode.metadata?.genres?.map(genre => genre.title) ?? []), 'WorldWide FM'];

  return Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean))).slice(0, 5);
}

export function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const TRACKLIST_HEADING = /^\s*track\s*-?\s*list(ing)?\b/i;
// "Artist - Title", optionally numbered. Sentences ("Live from Lisbon - a special one.") end in punctuation.
const TRACK_LINE = /^\s*(\d+[.)]\s*)?\S.{0,100}\s[-–—]\s\S.{0,100}(?<![.!?])$/;
const MIN_TRACK_RUN = 3;

/**
 * Submitters often paste the tracklist into the show copy. Cut everything from a
 * "Tracklist" heading on, and drop runs of 3+ consecutive "Artist - Title" lines.
 */
export function stripTracklistFromCopy(copy: string): string {
  const lines = copy.split('\n');
  const headingIndex = lines.findIndex(line => TRACKLIST_HEADING.test(line));
  const kept = headingIndex === -1 ? lines : lines.slice(0, headingIndex);

  const result: string[] = [];
  let run: string[] = [];
  const flushRun = () => {
    if (run.length < MIN_TRACK_RUN) result.push(...run);
    run = [];
  };

  for (const line of kept) {
    if (TRACK_LINE.test(line)) {
      run.push(line);
    } else {
      flushRun();
      result.push(line);
    }
  }
  flushRun();

  return result
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Keep the tracklist on the show page and include only its link alongside the show copy.
 */
export function buildMixcloudDescription(episode: EpisodeObject, showPageUrl: string): string {
  const showCopy = stripTracklistFromCopy(
    htmlToPlainText(episode.metadata?.body_text || episode.metadata?.description || '')
  );

  const sections = [showCopy];
  if (showPageUrl) {
    sections.push(`Tracklist: ${showPageUrl}`);
  }

  return sections.filter(Boolean).join('\n\n');
}
