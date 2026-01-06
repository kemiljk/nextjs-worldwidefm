import { NextRequest, NextResponse } from 'next/server';
import { cosmic } from '@/lib/cosmic-config';
import { put, head } from '@vercel/blob';

/**
 * Cron job to migrate old episode images from Cosmic to Vercel Blob.
 * 
 * This keeps Cosmic storage costs down by moving images for episodes
 * beyond position 1000 (sorted by broadcast_date) to Vercel Blob.
 * 
 * Vercel Pro plan includes 5 GB Blob storage.
 * 
 * Schedule: Weekly (configured in vercel.json)
 * 
 * Environment variables:
 *   CRON_SECRET           - For authentication
 *   BLOB_READ_WRITE_TOKEN - Vercel Blob token (auto-available in Vercel)
 */

const HOT_STORAGE_LIMIT = 1000;
const BATCH_SIZE = 50;
const MAX_MIGRATIONS_PER_RUN = 100; // Limit per cron run to avoid timeouts

interface EpisodeImage {
  url?: string;
  imgix_url?: string;
  name?: string;
}

interface Episode {
  id: string;
  slug: string;
  title: string;
  metadata: {
    image?: EpisodeImage;
    broadcast_date?: string;
  };
}

function isCosmicUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('imgix.cosmicjs.com') || 
         url.includes('cdn.cosmicjs.com') ||
         url.includes('cosmic-s3.imgix.net');
}

function isVercelBlobUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('.public.blob.vercel-storage.com') || 
         url.includes('.blob.vercel-storage.com');
}

function generateBlobPath(slug: string, originalFilename?: string): string {
  const ext = (originalFilename || 'image.jpg').split('.').pop()?.toLowerCase() || 'jpg';
  return `episodes/${slug}.${ext}`;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: HTTP ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return { buffer, contentType };
}

async function findCosmicMediaByUrl(imageUrl: string): Promise<{ id: string; name: string } | null> {
  try {
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1].split('?')[0];
    
    const response = await cosmic.media
      .find()
      .props(['id', 'name', 'url', 'imgix_url'])
      .limit(100);
    
    const media = response.media || [];
    
    for (const item of media) {
      if (item.url === imageUrl || 
          item.imgix_url === imageUrl ||
          item.name === filename ||
          item.url?.includes(filename) ||
          item.imgix_url?.includes(filename)) {
        return { id: item.id, name: item.name };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('[COLD-STORAGE] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Blob token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[COLD-STORAGE] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json({ 
        error: 'Vercel Blob not configured',
        hint: 'Create a Blob store in Vercel Dashboard > Storage',
      }, { status: 500 });
    }

    console.log('[COLD-STORAGE] Starting cold storage migration...');
    console.log(`[COLD-STORAGE] Hot storage limit: ${HOT_STORAGE_LIMIT} episodes`);

    // Fetch episodes sorted by broadcast_date DESC
    const allEpisodes: Episode[] = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore && allEpisodes.length < HOT_STORAGE_LIMIT + MAX_MIGRATIONS_PER_RUN + 100) {
      try {
        const response = await cosmic.objects
          .find({ type: 'episode' })
          .props('id,slug,title,metadata.image,metadata.broadcast_date')
          .sort('-metadata.broadcast_date')
          .limit(BATCH_SIZE)
          .skip(skip)
          .status('any');

        const episodes = response.objects || [];
        allEpisodes.push(...episodes);

        hasMore = episodes.length === BATCH_SIZE;
        skip += BATCH_SIZE;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('No objects found')) {
          hasMore = false;
        } else {
          console.error(`[COLD-STORAGE] Error fetching episodes: ${message}`);
          hasMore = false;
        }
      }
    }

    console.log(`[COLD-STORAGE] Fetched ${allEpisodes.length} episodes`);

    // Identify cold episodes with Cosmic images
    const coldEpisodes = allEpisodes.slice(HOT_STORAGE_LIMIT);
    const needsMigration = coldEpisodes.filter(ep => {
      const imageUrl = ep.metadata?.image?.url || ep.metadata?.image?.imgix_url;
      return imageUrl && isCosmicUrl(imageUrl);
    });

    console.log(`[COLD-STORAGE] Cold episodes: ${coldEpisodes.length}`);
    console.log(`[COLD-STORAGE] Need migration: ${needsMigration.length}`);

    if (needsMigration.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No episodes need migration',
        stats: {
          totalEpisodes: allEpisodes.length,
          coldEpisodes: coldEpisodes.length,
          needsMigration: 0,
        },
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      });
    }

    // Migrate up to MAX_MIGRATIONS_PER_RUN episodes
    const toMigrate = needsMigration.slice(0, MAX_MIGRATIONS_PER_RUN);
    const results = {
      migrated: 0,
      failed: 0,
      cosmicMediaDeleted: 0,
      errors: [] as string[],
    };

    for (const episode of toMigrate) {
      const imageUrl = episode.metadata?.image?.url || episode.metadata?.image?.imgix_url;
      if (!imageUrl) continue;

      const imageName = episode.metadata?.image?.name || imageUrl.split('/').pop()?.split('?')[0];
      const blobPath = generateBlobPath(episode.slug, imageName);

      try {
        // Check if already in Blob
        let blobUrl: string;
        try {
          const existing = await head(blobPath);
          blobUrl = existing.url;
          console.log(`[COLD-STORAGE] ${episode.slug}: Already in Blob`);
        } catch {
          // Download and upload
          console.log(`[COLD-STORAGE] ${episode.slug}: Migrating...`);
          const { buffer, contentType } = await downloadImage(imageUrl);
          
          const blob = await put(blobPath, buffer, {
            access: 'public',
            contentType,
            addRandomSuffix: false,
          });
          blobUrl = blob.url;
        }

        // Update Cosmic metadata
        await cosmic.objects.updateOne(episode.id, {
          metadata: {
            image: {
              url: blobUrl,
              imgix_url: blobUrl,
            },
          },
        });

        // Delete Cosmic media
        const cosmicMedia = await findCosmicMediaByUrl(imageUrl);
        if (cosmicMedia) {
          try {
            await cosmic.media.deleteOne(cosmicMedia.id);
            results.cosmicMediaDeleted++;
          } catch {
            // Non-critical
          }
        }

        results.migrated++;
        console.log(`[COLD-STORAGE] ${episode.slug}: ✅ Migrated`);
      } catch (error) {
        results.failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${episode.slug}: ${message}`);
        console.error(`[COLD-STORAGE] ${episode.slug}: ❌ ${message}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[COLD-STORAGE] Complete: ${results.migrated} migrated, ${results.failed} failed in ${duration}s`);

    return NextResponse.json({
      success: true,
      stats: {
        totalEpisodes: allEpisodes.length,
        coldEpisodes: coldEpisodes.length,
        needsMigration: needsMigration.length,
        processedThisRun: toMigrate.length,
        remainingToMigrate: needsMigration.length - toMigrate.length,
      },
      results,
      duration: `${duration}s`,
    });

  } catch (error) {
    console.error('[COLD-STORAGE] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

