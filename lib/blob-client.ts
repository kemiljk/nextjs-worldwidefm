import { put, del, head, list } from '@vercel/blob';

/**
 * Vercel Blob Client Utilities
 *
 * Vercel Blob provides simple object storage integrated with your Vercel project.
 * Pro plan includes 5 GB storage and 100 GB transfer/month.
 *
 * Required environment variable:
 *   BLOB_READ_WRITE_TOKEN - Get from Vercel Dashboard > Storage > Create Blob Store
 *
 * The token is automatically available in Vercel deployments once you create a Blob store.
 */

export { put, del, head, list };

/**
 * Check if Vercel Blob is configured
 */
export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Generate a storage path for an episode image
 * Format: episodes/{slug}.{ext}
 */
export function generateEpisodeImagePath(slug: string, originalFilename?: string): string {
  const ext = (originalFilename || 'image.jpg').split('.').pop()?.toLowerCase() || 'jpg';
  return `episodes/${slug}.${ext}`;
}

/**
 * Check if a URL is from Vercel Blob (already migrated)
 */
export function isVercelBlobUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('.public.blob.vercel-storage.com') || url.includes('.blob.vercel-storage.com')
  );
}

/**
 * Check if a URL is from Cosmic (needs migration)
 */
export function isCosmicUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('imgix.cosmicjs.com') ||
    url.includes('cdn.cosmicjs.com') ||
    url.includes('cosmic-s3.imgix.net')
  );
}

/**
 * Upload an image to Vercel Blob
 */
export async function uploadEpisodeImage(
  slug: string,
  imageBuffer: Buffer,
  contentType: string,
  originalFilename?: string
): Promise<{ url: string; pathname: string }> {
  const pathname = generateEpisodeImagePath(slug, originalFilename);

  const blob = await put(pathname, imageBuffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false, // Use exact pathname
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Check if an episode image exists in Vercel Blob
 */
export async function episodeImageExists(
  slug: string,
  originalFilename?: string
): Promise<boolean> {
  try {
    const pathname = generateEpisodeImagePath(slug, originalFilename);
    const result = await head(pathname);
    return !!result;
  } catch {
    return false;
  }
}

/**
 * Delete an episode image from Vercel Blob
 */
export async function deleteEpisodeImage(url: string): Promise<void> {
  await del(url);
}
