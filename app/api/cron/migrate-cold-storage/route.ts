import { NextRequest, NextResponse } from 'next/server';
import { cosmic } from '@/lib/cosmic-config';
import { put, head } from '@vercel/blob';

/**
 * Cron job to keep Cosmic media storage at or below 1000 items.
 * 
 * Strategy:
 * 1. Fetch all Cosmic media sorted by upload date (newest first)
 * 2. Keep the 1000 most recent
 * 3. Migrate older media to Vercel Blob
 * 4. Update any objects referencing the migrated media
 * 5. Delete migrated media from Cosmic
 * 
 * Schedule: Weekly (configured in vercel.json)
 * 
 * Environment variables:
 *   CRON_SECRET           - For authentication
 *   BLOB_READ_WRITE_TOKEN - Vercel Blob token (auto-available in Vercel)
 */

const HOT_STORAGE_LIMIT = 1000;
const MAX_MIGRATIONS_PER_RUN = 100; // Limit per cron run to avoid timeouts

// Object types that can have images
const OBJECT_TYPES_WITH_IMAGES = [
  'episode',
  'hosts',
  'takeovers',
  'posts',
  'videos',
  'events',
  'genres',
  'locations',
  'show-types',
  'about',
  'post-categories',
  'video-categories',
];

interface MediaItem {
  id: string;
  name: string;
  url: string;
  imgix_url: string;
  size?: number;
  created_at: string;
}

interface CosmicObject {
  id: string;
  slug: string;
  title: string;
  type: string;
  metadata?: {
    image?: {
      url?: string;
      imgix_url?: string;
      name?: string;
    };
  };
}

function extractFilename(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const urlPath = new URL(url).pathname;
    return urlPath.split('/').pop()?.split('?')[0] || null;
  } catch {
    return url.split('/').pop()?.split('?')[0] || null;
  }
}

function generateBlobPath(mediaItem: MediaItem): string {
  const filename = mediaItem.name || extractFilename(mediaItem.url) || `media-${mediaItem.id}`;
  return `cosmic-archive/${filename}`;
}

async function downloadMedia(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: HTTP ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return { buffer, contentType };
}

async function findObjectsReferencingMedia(mediaItem: MediaItem): Promise<CosmicObject[]> {
  const filename = mediaItem.name || extractFilename(mediaItem.url);
  const results: CosmicObject[] = [];
  
  for (const objectType of OBJECT_TYPES_WITH_IMAGES) {
    try {
      const response = await cosmic.objects
        .find({ type: objectType })
        .props('id,slug,title,type,metadata.image')
        .limit(100)
        .status('any');
      
      const objects = response.objects || [];
      
      for (const obj of objects) {
        const objImageUrl = obj.metadata?.image?.url;
        const objImgixUrl = obj.metadata?.image?.imgix_url;
        const objImageName = obj.metadata?.image?.name;
        
        // Check all possible matches
        if (objImageName === filename ||
            objImageUrl === mediaItem.url ||
            objImgixUrl === mediaItem.imgix_url ||
            (objImageUrl && filename && objImageUrl.includes(filename)) ||
            (objImgixUrl && filename && objImgixUrl.includes(filename))) {
          results.push(obj as CosmicObject);
        }
      }
    } catch {
      // Skip object types that don't exist
    }
  }
  
  return results;
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
    console.log(`[COLD-STORAGE] Hot storage limit: ${HOT_STORAGE_LIMIT} media items`);

    // Fetch media sorted by created_at DESC (newest first)
    const allMedia: MediaItem[] = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore && allMedia.length < HOT_STORAGE_LIMIT + MAX_MIGRATIONS_PER_RUN + 100) {
      try {
        const response = await cosmic.media
          .find()
          .props(['id', 'name', 'url', 'imgix_url', 'size', 'created_at'])
          .sort('-created_at')
          .limit(100)
          .skip(skip);

        const media = response.media || [];
        allMedia.push(...media);

        hasMore = media.length === 100;
        skip += 100;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[COLD-STORAGE] Error fetching media: ${message}`);
        hasMore = false;
      }
    }

    console.log(`[COLD-STORAGE] Fetched ${allMedia.length} media items`);

    // Identify cold media (beyond position 1000)
    const coldMedia = allMedia.slice(HOT_STORAGE_LIMIT);
    
    console.log(`[COLD-STORAGE] Hot media (kept): ${Math.min(allMedia.length, HOT_STORAGE_LIMIT)}`);
    console.log(`[COLD-STORAGE] Cold media (to migrate): ${coldMedia.length}`);

    if (coldMedia.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Media count is at or below limit, nothing to migrate',
        stats: {
          totalMedia: allMedia.length,
          hotMedia: allMedia.length,
          coldMedia: 0,
        },
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      });
    }

    // Migrate up to MAX_MIGRATIONS_PER_RUN media items
    const toMigrate = coldMedia.slice(0, MAX_MIGRATIONS_PER_RUN);
    const results = {
      migrated: 0,
      failed: 0,
      objectsUpdated: 0,
      errors: [] as string[],
    };

    for (const mediaItem of toMigrate) {
      const blobPath = generateBlobPath(mediaItem);
      const downloadUrl = mediaItem.imgix_url || mediaItem.url;

      try {
        // Check if already in Blob
        let blobUrl: string;
        try {
          const existing = await head(blobPath);
          blobUrl = existing.url;
          console.log(`[COLD-STORAGE] ${mediaItem.name}: Already in Blob`);
        } catch {
          // Download and upload
          console.log(`[COLD-STORAGE] ${mediaItem.name}: Migrating...`);
          const { buffer, contentType } = await downloadMedia(downloadUrl);
          
          const blob = await put(blobPath, buffer, {
            access: 'public',
            contentType,
            addRandomSuffix: false,
          });
          blobUrl = blob.url;
        }

        // Find and update objects referencing this media
        const referencingObjects = await findObjectsReferencingMedia(mediaItem);
        
        for (const obj of referencingObjects) {
          try {
            await cosmic.objects.updateOne(obj.id, {
              metadata: {
                external_image_url: blobUrl,
              },
            });
            results.objectsUpdated++;
            console.log(`[COLD-STORAGE] Updated ${obj.type}/${obj.slug}`);
          } catch (updateError) {
            console.error(`[COLD-STORAGE] Failed to update ${obj.type}/${obj.slug}`);
          }
        }

        // Delete from Cosmic media
        try {
          await cosmic.media.deleteOne(mediaItem.id);
          console.log(`[COLD-STORAGE] ${mediaItem.name}: ✅ Migrated and deleted`);
        } catch {
          console.log(`[COLD-STORAGE] ${mediaItem.name}: ✅ Migrated (delete failed)`);
        }

        results.migrated++;
      } catch (error) {
        results.failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${mediaItem.name}: ${message}`);
        console.error(`[COLD-STORAGE] ${mediaItem.name}: ❌ ${message}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[COLD-STORAGE] Complete: ${results.migrated} migrated, ${results.failed} failed in ${duration}s`);

    return NextResponse.json({
      success: true,
      stats: {
        totalMedia: allMedia.length,
        hotMedia: Math.min(allMedia.length, HOT_STORAGE_LIMIT),
        coldMedia: coldMedia.length,
        processedThisRun: toMigrate.length,
        remainingToMigrate: coldMedia.length - toMigrate.length,
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
