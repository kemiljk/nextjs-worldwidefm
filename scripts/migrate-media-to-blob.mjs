#!/usr/bin/env node

/**
 * Cosmic Media Cold Storage Migration Script
 *
 * Keeps the 500 most recently uploaded media items on Cosmic.
 * Migrates all older media to Vercel Blob, updating any objects that reference them.
 *
 * This reduces Cosmic storage costs while keeping images accessible.
 *
 * Usage:
 *   # Step 1: Preview what would be migrated
 *   DRY_RUN=true bun run scripts/migrate-media-to-blob.mjs
 *
 *   # Step 2: Migrate (upload to Blob + update Cosmic objects, but keep Cosmic media)
 *   DRY_RUN=false bun run scripts/migrate-media-to-blob.mjs
 *
 *   # Step 3: After verifying no regression, delete Cosmic media (fast mode)
 *   DELETE_ONLY=true bun run scripts/migrate-media-to-blob.mjs
 *
 * Environment variables:
 *   # Cosmic
 *   NEXT_PUBLIC_COSMIC_BUCKET_SLUG
 *   NEXT_PUBLIC_COSMIC_READ_KEY
 *   COSMIC_WRITE_KEY
 *
 *   # Vercel Blob
 *   BLOB_READ_WRITE_TOKEN - Get from Vercel Dashboard > Storage > Blob
 *
 *   # Options
 *   DRY_RUN              - "true" (default) or "false"
 *   DELETE_MEDIA         - "true" to delete Cosmic media after migration (default: false)
 *   DELETE_ONLY          - "true" to skip migration, just delete cold media (fast cleanup)
 *   HOT_STORAGE_LIMIT    - Number of media items to keep on Cosmic (default: 500)
 *   BATCH_SIZE           - Items to fetch per batch (default: 100)
 */

import { createBucketClient } from '@cosmicjs/sdk';
import { put, head } from '@vercel/blob';
import fs from 'fs';

const CONFIG = {
  bucketSlug: process.env.COSMIC_BUCKET_SLUG || process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,

  blobToken: process.env.BLOB_READ_WRITE_TOKEN,

  dryRun: process.env.DRY_RUN !== 'false',
  deleteMedia: process.env.DELETE_MEDIA === 'true',
  deleteOnly: process.env.DELETE_ONLY === 'true', // Skip migration, just delete cold media
  hotStorageLimit: parseInt(process.env.HOT_STORAGE_LIMIT || '500', 10),
  batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),

  downloadDelay: 100,
  uploadDelay: 50,
  cosmicWriteDelay: 200,

  stateFile: './media-migration-state.json',
  reportFile: './media-migration-report.json',

  // Add external_image_url field to these in Cosmic
  objectTypesWithImages: [
    'episode',
    'regular-hosts',
    'takeovers',
    'posts',
    'videos',
    'events',
    'genres',
    'locations',
    'about',
    'post-categories',
    'video-categories',
  ],
};

if (!CONFIG.bucketSlug || !CONFIG.readKey || !CONFIG.writeKey) {
  console.error('❌ Missing Cosmic credentials');
  process.exit(1);
}

const blobConfigured = !!CONFIG.blobToken;

if (!CONFIG.dryRun && !blobConfigured) {
  console.error('❌ Missing BLOB_READ_WRITE_TOKEN');
  console.error('  Get it from: Vercel Dashboard > Storage > Create Blob Store');
  process.exit(1);
}

const cosmic = createBucketClient({
  bucketSlug: CONFIG.bucketSlug,
  readKey: CONFIG.readKey,
  writeKey: CONFIG.writeKey,
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function extractFilename(url) {
  if (!url) return null;
  try {
    const urlPath = new URL(url).pathname;
    return urlPath.split('/').pop()?.split('?')[0] || null;
  } catch {
    return url.split('/').pop()?.split('?')[0] || null;
  }
}

function generateBlobPath(mediaItem) {
  const filename = mediaItem.name || extractFilename(mediaItem.url) || `media-${mediaItem.id}`;
  return `cosmic-archive/${filename}`;
}

async function existsInBlob(pathname) {
  if (!blobConfigured) return false;

  try {
    const result = await head(pathname);
    return result?.url || false;
  } catch {
    return false;
  }
}

async function uploadToBlob(pathname, buffer, contentType) {
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });

  return blob.url;
}

async function downloadMedia(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType, size: buffer.length };
}

async function fetchAllMedia() {
  console.log('\n📸 Fetching all Cosmic media (sorted by upload date)...');
  const allMedia = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await cosmic.media
        .find()
        .props(['id', 'name', 'url', 'imgix_url', 'size', 'created_at', 'type'])
        .sort('-created_at')
        .limit(CONFIG.batchSize)
        .skip(skip);

      const media = response.media || [];
      allMedia.push(...media);

      if (allMedia.length % 500 === 0) {
        console.log(`  ... ${allMedia.length} media items fetched`);
      }

      hasMore = media.length === CONFIG.batchSize;
      skip += CONFIG.batchSize;
    } catch (error) {
      if (error?.message?.includes('No media found')) {
        hasMore = false;
      } else {
        console.error(`  ⚠️  Error at skip=${skip}: ${error.message}`);
        await sleep(2000);
        hasMore = false;
      }
    }
  }

  console.log(`  ✅ Total media items: ${allMedia.length}`);
  return allMedia;
}

async function findObjectsReferencingMedia(mediaItem) {
  const filename = mediaItem.name || extractFilename(mediaItem.url);
  const imgixUrl = mediaItem.imgix_url;
  const url = mediaItem.url;

  const referencingObjects = [];

  for (const objectType of CONFIG.objectTypesWithImages) {
    try {
      let skip = 0;
      const limit = 100;

      while (true) {
        const response = await cosmic.objects
          .find({ type: objectType })
          .props('id,slug,title,type,metadata')
          .limit(limit)
          .skip(skip)
          .status('any');

        const objects = response.objects || [];
        if (objects.length === 0) break;

        for (const obj of objects) {
          const objImageUrl = obj.metadata?.image?.url || obj.metadata?.image?.imgix_url;
          const objImageName = obj.metadata?.image?.name;

          if (
            objImageUrl === url ||
            objImageUrl === imgixUrl ||
            objImageName === filename ||
            (objImageUrl && filename && objImageUrl.includes(filename))
          ) {
            referencingObjects.push({
              id: obj.id,
              slug: obj.slug,
              title: obj.title,
              type: obj.type,
            });
          }
        }

        if (objects.length < limit) break;
        skip += limit;
      }
    } catch (error) {
      // Skip object types that don't exist or have errors
      if (!error?.message?.includes('Object type not found')) {
        console.error(`  ⚠️  Error checking ${objectType}: ${error.message}`);
      }
    }
  }

  return referencingObjects;
}

async function updateObjectWithExternalUrl(obj, blobUrl) {
  try {
    await cosmic.objects.updateOne(obj.id, {
      metadata: {
        external_image_url: blobUrl,
      },
    });
    return true;
  } catch (error) {
    console.error(`    ⚠️  Failed to update ${obj.type}/${obj.slug}: ${error.message}`);
    return false;
  }
}

async function migrateMediaItem(mediaItem, index, total, allReferences) {
  console.log(`\n  [${index + 1}/${total}] ${mediaItem.name || mediaItem.id}`);
  console.log(`    Size: ${formatBytes(mediaItem.size)}`);
  console.log(`    Uploaded: ${mediaItem.created_at}`);

  const blobPath = generateBlobPath(mediaItem);
  const downloadUrl = mediaItem.imgix_url || mediaItem.url;

  const references = allReferences.get(mediaItem.id) || [];
  console.log(`    Referenced by: ${references.length} object(s)`);

  if (CONFIG.dryRun) {
    console.log(`    ⏭️  DRY RUN - Would migrate to: ${blobPath}`);
    if (references.length > 0) {
      console.log(`    Would update: ${references.map(r => `${r.type}/${r.slug}`).join(', ')}`);
    }
    return { success: true, dryRun: true, references: references.length };
  }

  try {
    const existingBlobUrl = await existsInBlob(blobPath);
    let blobUrl;
    let bytesUploaded = 0;

    if (existingBlobUrl) {
      console.log(`    ✅ Already in Blob`);
      blobUrl = existingBlobUrl;
    } else {
      console.log(`    ⬇️  Downloading from Cosmic...`);
      const { buffer, contentType, size } = await downloadMedia(downloadUrl);
      bytesUploaded = size;

      await sleep(CONFIG.downloadDelay);

      console.log(`    ⬆️  Uploading to Vercel Blob...`);
      blobUrl = await uploadToBlob(blobPath, buffer, contentType);

      await sleep(CONFIG.uploadDelay);
    }

    let objectsUpdated = 0;
    for (const ref of references) {
      console.log(`    📝 Updating ${ref.type}/${ref.slug}...`);
      const updated = await updateObjectWithExternalUrl(ref, blobUrl);
      if (updated) objectsUpdated++;
      await sleep(CONFIG.cosmicWriteDelay);
    }

    let mediaDeleted = false;
    if (CONFIG.deleteMedia) {
      console.log(`    🗑️  Deleting from Cosmic media...`);
      try {
        await cosmic.media.deleteOne(mediaItem.id);
        console.log(`    ✅ Deleted from Cosmic`);
        mediaDeleted = true;
      } catch (deleteError) {
        console.log(`    ⚠️  Could not delete: ${deleteError.message}`);
      }
    } else {
      console.log(`    ⏭️  Skipping deletion (DELETE_MEDIA not set)`);
    }

    console.log(`    ✅ Migrated to: ${blobUrl}`);
    return {
      success: true,
      blobUrl,
      bytesUploaded,
      objectsUpdated,
      references: references.length,
      mediaDeleted,
    };
  } catch (error) {
    console.log(`    ❌ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function buildMediaReferenceMap(mediaToMigrate) {
  console.log('\n🔗 Building media reference map...');

  const referenceMap = new Map();

  for (const media of mediaToMigrate) {
    referenceMap.set(media.id, []);
  }

  const mediaLookup = new Map();
  for (const media of mediaToMigrate) {
    const filename = media.name || extractFilename(media.url);
    if (filename) mediaLookup.set(filename, media.id);
    if (media.url) mediaLookup.set(media.url, media.id);
    if (media.imgix_url) mediaLookup.set(media.imgix_url, media.id);
  }

  for (const objectType of CONFIG.objectTypesWithImages) {
    console.log(`  Scanning ${objectType}...`);

    try {
      let skip = 0;
      const limit = 100;
      let objectCount = 0;

      while (true) {
        const response = await cosmic.objects
          .find({ type: objectType })
          .props('id,slug,title,type,metadata.image')
          .limit(limit)
          .skip(skip)
          .status('any');

        const objects = response.objects || [];
        if (objects.length === 0) break;

        for (const obj of objects) {
          const objImageUrl = obj.metadata?.image?.url;
          const objImgixUrl = obj.metadata?.image?.imgix_url;
          const objImageName = obj.metadata?.image?.name;

          let mediaId = null;
          if (objImageName && mediaLookup.has(objImageName)) {
            mediaId = mediaLookup.get(objImageName);
          } else if (objImageUrl && mediaLookup.has(objImageUrl)) {
            mediaId = mediaLookup.get(objImageUrl);
          } else if (objImgixUrl && mediaLookup.has(objImgixUrl)) {
            mediaId = mediaLookup.get(objImgixUrl);
          } else if (objImageUrl) {
            const filename = extractFilename(objImageUrl);
            if (filename && mediaLookup.has(filename)) {
              mediaId = mediaLookup.get(filename);
            }
          }

          if (mediaId && referenceMap.has(mediaId)) {
            referenceMap.get(mediaId).push({
              id: obj.id,
              slug: obj.slug,
              title: obj.title,
              type: obj.type,
            });
          }
        }

        objectCount += objects.length;
        if (objects.length < limit) break;
        skip += limit;
      }

      console.log(`    Found ${objectCount} ${objectType} objects`);
    } catch (error) {
      if (!error?.message?.includes('Object type not found')) {
        console.error(`    ⚠️  Error: ${error.message}`);
      }
    }
  }

  let totalRefs = 0;
  for (const refs of referenceMap.values()) {
    totalRefs += refs.length;
  }
  console.log(
    `  ✅ Found ${totalRefs} total references across ${mediaToMigrate.length} media items`
  );

  return referenceMap;
}

function saveState(state) {
  try {
    fs.writeFileSync(
      CONFIG.stateFile,
      JSON.stringify({ ...state, timestamp: new Date().toISOString() }, null, 2)
    );
  } catch {
    // Non-critical
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Cosmic Media Cold Storage Migration');
  console.log(
    CONFIG.deleteOnly
      ? '  DELETE ONLY MODE - Skip migration, just delete cold media'
      : '  Keep 500 most recent → Migrate older to Vercel Blob'
  );
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Cosmic Bucket: ${CONFIG.bucketSlug}`);
  console.log(`  Hot Storage Limit: ${CONFIG.hotStorageLimit} media items`);
  if (CONFIG.deleteOnly) {
    console.log(`  Mode: 🗑️  DELETE ONLY (will delete cold media from Cosmic)`);
  } else {
    console.log(
      `  Mode: ${CONFIG.dryRun ? '🏃 DRY RUN (preview only)' : '🚀 LIVE (will migrate)'}`
    );
    console.log(
      `  Delete Media: ${CONFIG.deleteMedia ? '🗑️  YES (will delete from Cosmic)' : '⏸️  NO (keep on Cosmic for verification)'}`
    );
    console.log(`  Vercel Blob: ${blobConfigured ? '✅ Configured' : '⚠️ Not configured'}`);
  }
  console.log('═══════════════════════════════════════════════════════════════════');

  const startTime = Date.now();
  saveState({ phase: 'starting' });

  try {
    const allMedia = await fetchAllMedia();

    if (allMedia.length === 0) {
      console.log('\n❌ No media found');
      return;
    }

    saveState({ phase: 'media_fetched', count: allMedia.length });

    const hotMedia = allMedia.slice(0, CONFIG.hotStorageLimit);
    const coldMedia = allMedia.slice(CONFIG.hotStorageLimit);

    console.log(`\n📊 Media Storage Split:`);
    console.log(`  🔥 Hot storage (newest ${CONFIG.hotStorageLimit}): ${hotMedia.length} items`);
    console.log(`  ❄️  Cold storage (older): ${coldMedia.length} items`);

    const hotSize = hotMedia.reduce((sum, m) => sum + (m.size || 0), 0);
    const coldSize = coldMedia.reduce((sum, m) => sum + (m.size || 0), 0);
    console.log(`\n  💾 Storage breakdown:`);
    console.log(`    Hot (Cosmic): ${formatBytes(hotSize)}`);
    console.log(`    Cold (to migrate): ${formatBytes(coldSize)}`);

    if (coldMedia.length === 0) {
      console.log('\n✅ No media needs migration - already at or below limit!');
      return;
    }

    saveState({
      phase: 'split_identified',
      hot: hotMedia.length,
      cold: coldMedia.length,
      hotSize,
      coldSize,
    });

    if (CONFIG.deleteOnly) {
      console.log(
        `\n🗑️  DELETE ONLY: Removing ${coldMedia.length} cold media items from Cosmic...`
      );

      let deleted = 0;
      let failed = 0;
      const errors = [];

      for (let i = 0; i < coldMedia.length; i++) {
        const mediaItem = coldMedia[i];

        try {
          await cosmic.media.deleteOne(mediaItem.id);
          deleted++;

          if ((i + 1) % 50 === 0 || i === coldMedia.length - 1) {
            console.log(
              `  Progress: ${i + 1}/${coldMedia.length} (${deleted} deleted, ${failed} failed)`
            );
          }
        } catch (error) {
          failed++;
          errors.push({ id: mediaItem.id, name: mediaItem.name, error: error.message });
        }

        // Small delay to avoid rate limiting
        await sleep(50);
      }

      console.log('\n═══════════════════════════════════════════════════════════════════');
      console.log('  DELETE ONLY SUMMARY');
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log(`  Cold media items: ${coldMedia.length}`);
      console.log(`  Successfully deleted: ${deleted}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Storage freed: ~${formatBytes(coldSize)}`);
      console.log('═══════════════════════════════════════════════════════════════════');

      const report = {
        timestamp: new Date().toISOString(),
        mode: 'DELETE_ONLY',
        stats: { totalMedia: allMedia.length, coldMedia: coldMedia.length },
        results: { deleted, failed, errors },
      };
      fs.writeFileSync(CONFIG.reportFile, JSON.stringify(report, null, 2));
      console.log(`\n📝 Report saved to: ${CONFIG.reportFile}`);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ Completed in ${elapsed}s`);
      return;
    }

    const referenceMap = await buildMediaReferenceMap(coldMedia);

    saveState({ phase: 'references_mapped' });

    console.log(`\n🚀 Starting migration of ${coldMedia.length} media items...`);

    const results = {
      migrated: 0,
      failed: 0,
      skipped: 0,
      bytesUploaded: 0,
      objectsUpdated: 0,
      mediaDeleted: 0,
      errors: [],
    };

    for (let i = 0; i < coldMedia.length; i++) {
      const mediaItem = coldMedia[i];
      const result = await migrateMediaItem(mediaItem, i, coldMedia.length, referenceMap);

      if (result.success) {
        if (result.dryRun) {
          results.skipped++;
        } else {
          results.migrated++;
          results.bytesUploaded += result.bytesUploaded || 0;
          results.objectsUpdated += result.objectsUpdated || 0;
          if (result.mediaDeleted) results.mediaDeleted++;
        }
      } else {
        results.failed++;
        results.errors.push({
          mediaId: mediaItem.id,
          name: mediaItem.name,
          error: result.error,
        });
      }

      if ((i + 1) % 50 === 0) {
        saveState({
          phase: 'migrating',
          progress: i + 1,
          total: coldMedia.length,
          ...results,
        });
        console.log(
          `\n  📊 Progress: ${i + 1}/${coldMedia.length} (${formatBytes(results.bytesUploaded)} uploaded)`
        );
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('  MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  Total media items: ${allMedia.length}`);
    console.log(`  Hot storage (kept on Cosmic): ${hotMedia.length} (${formatBytes(hotSize)})`);
    console.log(`  Cold storage (migrated): ${coldMedia.length} (${formatBytes(coldSize)})`);

    if (CONFIG.dryRun) {
      console.log(`\n  🏃 DRY RUN RESULTS:`);
      console.log(`    Would migrate: ${results.skipped} media items`);
      console.log(`    Would upload: ~${formatBytes(coldSize)}`);
    } else {
      console.log(`\n  🚀 MIGRATION RESULTS:`);
      console.log(`    Successfully migrated: ${results.migrated}`);
      console.log(`    Bytes uploaded to Blob: ${formatBytes(results.bytesUploaded)}`);
      console.log(`    Objects updated: ${results.objectsUpdated}`);
      console.log(
        `    Cosmic media deleted: ${results.mediaDeleted}${!CONFIG.deleteMedia ? ' (DELETE_MEDIA not set)' : ''}`
      );
      console.log(`    Failed: ${results.failed}`);

      if (!CONFIG.deleteMedia && results.migrated > 0) {
        console.log(`\n  📋 NEXT STEP:`);
        console.log(`    Verify images load correctly from Vercel Blob, then run:`);
        console.log(
          `    DRY_RUN=false DELETE_MEDIA=true bun run scripts/migrate-media-to-blob.mjs`
        );
      }
    }
    console.log('═══════════════════════════════════════════════════════════════════');

    const report = {
      timestamp: new Date().toISOString(),
      dryRun: CONFIG.dryRun,
      hotStorageLimit: CONFIG.hotStorageLimit,
      cosmicBucket: CONFIG.bucketSlug,
      stats: {
        totalMedia: allMedia.length,
        hotStorage: hotMedia.length,
        coldStorage: coldMedia.length,
        hotStorageSize: hotSize,
        coldStorageSize: coldSize,
      },
      results,
    };

    fs.writeFileSync(CONFIG.reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📝 Report saved to: ${CONFIG.reportFile}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Completed in ${elapsed}s`);
    saveState({ phase: 'complete', ...results, elapsed });
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    saveState({ phase: 'error', error: error.message });
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
