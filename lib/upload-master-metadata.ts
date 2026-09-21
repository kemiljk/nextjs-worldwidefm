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

/**
 * Keep the tracklist on the show page and include only its link alongside the show copy.
 */
export function buildMixcloudDescription(episode: EpisodeObject, showPageUrl: string): string {
  const showCopy = htmlToPlainText(
    episode.metadata?.body_text || episode.metadata?.description || ''
  );

  const sections = [showCopy];
  if (showPageUrl) {
    sections.push(`Tracklist: ${showPageUrl}`);
  }

  return sections.filter(Boolean).join('\n\n');
}
