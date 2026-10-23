import { revalidateContent } from './content-revalidation';
import { revalidatePath } from 'next/cache';
import { cosmic } from '@/lib/cosmic-config';

/** Metafields the upload-master flow writes back to an episode after archiving. */
export type EpisodeArchiveUpdates = {
  radiocult_media_id?: string;
  player?: string | null;
  page_link?: string | null;
  mixcloud_pending_url?: string | null;
  regular_hosts?: string[];
};

export function revalidateEpisodeCaches(slug?: string) {
  revalidateContent('episode', slug);
  if (slug) {
    revalidatePath(`/episode/${slug}`);
  }
}

/**
 * Write archive metafields onto an episode and clear the caches that serve it.
 * Cosmic merges the metadata keys it is sent, so only the supplied fields change.
 */
export async function updateEpisodeArchive(
  id: string,
  updates: EpisodeArchiveUpdates,
  slug?: string
): Promise<void> {
  await cosmic.objects.updateOne(id, {
    metadata: updates,
  });

  revalidateEpisodeCaches(slug);
}

/**
 * Queue a Mixcloud cloudcast URL on an episode. Uploads are scheduled to publish
 * at the end of the broadcast, so the URL is held in `mixcloud_pending_url` until
 * the publish cron confirms the cloudcast is live. Writing `player` straight away
 * shows Listen Back for a cloudcast Mixcloud can't serve yet.
 */
export async function saveMixcloudLinkToEpisode(
  episodeId: string,
  mixcloudUrl: string,
  episodeSlug?: string
): Promise<void> {
  await updateEpisodeArchive(episodeId, { mixcloud_pending_url: mixcloudUrl }, episodeSlug);
}

/**
 * Promote a live cloudcast onto an episode. Both metafields carry the same URL:
 * `player` drives the site's archive player, `page_link` the outbound link.
 */
export async function publishMixcloudLinkToEpisode(
  episodeId: string,
  mixcloudUrl: string,
  episodeSlug?: string
): Promise<void> {
  await updateEpisodeArchive(
    episodeId,
    { player: mixcloudUrl, page_link: mixcloudUrl, mixcloud_pending_url: '' },
    episodeSlug
  );
}
