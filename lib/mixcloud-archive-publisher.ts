import { cosmic } from '@/lib/cosmic-config';
import { publishMixcloudLinkToEpisode } from '@/lib/episode-archive';
import { getMixcloudApiBaseUrl } from '@/lib/upload-config';
import { mixcloudHostUsernames } from '@/lib/mixcloud-username';

const LOOKUP_TIMEOUT_MS = 10_000;
const MAX_PENDING_PER_RUN = 100;

type PendingEpisode = {
  id: string;
  slug?: string;
  metadata?: {
    mixcloud_pending_url?: string | null;
    regular_hosts?: { title?: string; metadata?: { mixcloud_username?: string | null } | null }[];
  };
};

/** A published cloudcast that Mixcloud did not tag with every host we asked it to. */
export type HostTagWarning = {
  id: string;
  slug?: string;
  url: string;
  expected: string[];
  tagged: string[];
  missing: string[];
};

export type PublishPendingResult = {
  checked: number;
  published: string[];
  pending: string[];
  failed: { id: string; error: string }[];
  hostWarnings: HostTagWarning[];
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
  return (await lookupMixcloudCloudcast(url, options)).live;
}

/**
 * Looks the cloudcast up as a listener would. `hosts` is the usernames Mixcloud has
 * tagged, or undefined when the response doesn't say (so callers never guess).
 */
export async function lookupMixcloudCloudcast(
  url: string,
  options: Options = {}
): Promise<{ live: boolean; hosts?: string[] }> {
  const key = mixcloudKeyFromUrl(url);
  if (!key) return { live: false };

  const fetchImpl = options.fetchFn ?? fetch;
  const response = await fetchImpl(`${options.apiBaseUrl ?? getMixcloudApiBaseUrl()}${key}`, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (response.status === 404) return { live: false };
  if (!response.ok) {
    throw new Error(`Mixcloud lookup failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as { key?: string; hosts?: { username?: string }[] };
  if (data.key !== key) return { live: false };
  return {
    live: true,
    hosts: Array.isArray(data.hosts)
      ? data.hosts.map(host => host?.username ?? '').filter(Boolean)
      : undefined,
  };
}

/** Hosts we asked Mixcloud to tag that it didn't. Empty when none were requested. */
export function findMissingHostTags(
  expectedUsernames: string[],
  taggedUsernames: string[]
): string[] {
  const tagged = new Set(taggedUsernames.map(username => username.toLowerCase()));
  return expectedUsernames.filter(username => !tagged.has(username.toLowerCase()));
}

async function fetchPendingEpisodes(): Promise<PendingEpisode[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'episode',
        'metadata.mixcloud_pending_url': { $regex: '\\S' },
      })
      .props('id,slug,metadata.mixcloud_pending_url,metadata.regular_hosts')
      .limit(MAX_PENDING_PER_RUN)
      .depth(1)
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
    hostWarnings: [],
  };

  for (const episode of episodes) {
    const url = episode.metadata?.mixcloud_pending_url?.trim();
    if (!url) continue;

    try {
      const cloudcast = await lookupMixcloudCloudcast(url, options);
      if (cloudcast.live) {
        await publishMixcloudLinkToEpisode(episode.id, url, episode.slug);
        result.published.push(episode.id);

        // Mixcloud silently drops a host it can't tag (unknown username, invite not
        // accepted). Now that the cloudcast is public, check and report it.
        if (cloudcast.hosts) {
          const expected = mixcloudHostUsernames(
            (episode.metadata?.regular_hosts ?? []).map(host => host?.metadata?.mixcloud_username)
          );
          const missing = findMissingHostTags(expected, cloudcast.hosts);
          if (missing.length > 0) {
            result.hostWarnings.push({
              id: episode.id,
              slug: episode.slug,
              url,
              expected,
              tagged: cloudcast.hosts,
              missing,
            });
          }
        }
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
