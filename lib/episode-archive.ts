import { revalidateContent } from './content-revalidation';
import { revalidatePath } from 'next/cache';
import { cosmic } from '@/lib/cosmic-config';

/** Metafields the upload-master flow writes back to an episode after archiving. */
export type EpisodeArchiveUpdates = {
  radiocult_media_id?: string;
  player?: string | null;
  page_link?: string | null;
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
 * Save a Mixcloud cloudcast URL onto an episode. Both metafields carry the same
 * URL: `player` drives the site's archive player, `page_link` the outbound link.
 */
export async function saveMixcloudLinkToEpisode(
  episodeId: string,
  mixcloudUrl: string,
  episodeSlug?: string
): Promise<void> {
  await updateEpisodeArchive(
    episodeId,
    { player: mixcloudUrl, page_link: mixcloudUrl },
    episodeSlug
  );
}
