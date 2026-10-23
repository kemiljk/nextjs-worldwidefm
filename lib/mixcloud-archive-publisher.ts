import { cosmic } from '@/lib/cosmic-config';
import { publishMixcloudLinkToEpisode } from '@/lib/episode-archive';
import { getMixcloudApiBaseUrl } from '@/lib/upload-config';

const LOOKUP_TIMEOUT_MS = 10_000;
const MAX_PENDING_PER_RUN = 100;

type PendingEpisode = {
  id: string;
  slug?: string;
  metadata?: { mixcloud_pending_url?: string | null };
};

export type PublishPendingResult = {
  checked: number;
  published: string[];
  pending: string[];
  failed: { id: string; error: string }[];
};

type Options = {
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
};

/** `https://www.mixcloud.com/worldwidefm/show/` → `/worldwidefm/show/`, or null if not a cloudcast URL. */
export function mixcloudKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)mixcloud\.com$/.test(parsed.hostname)) return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;

    return `/${segments.join('/')}/`;
  } catch {
    return null;
  }
}

/**
 * True once the cloudcast is publicly visible. The lookup is unauthenticated on
 * purpose: scheduled uploads and drafts are only visible to the owner, so a
 * public 200 means listeners can actually play it.
 */
export async function isMixcloudCloudcastLive(
  url: string,
  options: Options = {}
): Promise<boolean> {
  const key = mixcloudKeyFromUrl(url);
  if (!key) return false;

  const fetchImpl = options.fetchFn ?? fetch;
  const response = await fetchImpl(`${options.apiBaseUrl ?? getMixcloudApiBaseUrl()}${key}`, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Mixcloud lookup failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as { key?: string };
  return data.key === key;
}

async function fetchPendingEpisodes(): Promise<PendingEpisode[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'episode',
        'metadata.mixcloud_pending_url': { $regex: '\\S' },
      })
      .props('id,slug,metadata.mixcloud_pending_url')
      .limit(MAX_PENDING_PER_RUN)
      .status('any');

    return (response.objects ?? []) as PendingEpisode[];
  } catch (error) {
    if ((error as { status?: number })?.status === 404) return [];
    throw error;
  }
}

/** Move every pending Mixcloud URL whose cloudcast is now live onto `player`. */
export async function publishPendingMixcloudArchives(
  options: Options = {}
): Promise<PublishPendingResult> {
  const episodes = await fetchPendingEpisodes();
  const result: PublishPendingResult = {
    checked: episodes.length,
    published: [],
    pending: [],
    failed: [],
  };

  for (const episode of episodes) {
    const url = episode.metadata?.mixcloud_pending_url?.trim();
    if (!url) continue;

    try {
      if (await isMixcloudCloudcastLive(url, options)) {
        await publishMixcloudLinkToEpisode(episode.id, url, episode.slug);
        result.published.push(episode.id);
      } else {
        result.pending.push(episode.id);
      }
    } catch (error) {
      result.failed.push({
        id: episode.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
