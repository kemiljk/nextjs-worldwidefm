#!/usr/bin/env node

/**
 * Episode Image Cold Storage Migration Script
 *
 * Moves episode images beyond position 1000 from Cosmic to Vercel Blob.
 * This reduces Cosmic storage costs while keeping images accessible.
 *
 * Vercel Pro plan includes 5 GB storage and 100 GB transfer/month.
 *
 * Usage:
 *   DRY_RUN=true bun run scripts/migrate-images-to-blob.mjs   # Preview (default)
 *   DRY_RUN=false bun run scripts/migrate-images-to-blob.mjs  # Actually migrate
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
 *   HOT_STORAGE_LIMIT    - Number of episodes to keep on Cosmic (default: 1000)
 *   BATCH_SIZE           - Episodes to fetch per batch (default: 50)
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
  hotStorageLimit: parseInt(process.env.HOT_STORAGE_LIMIT || '1000', 10),
  batchSize: parseInt(process.env.BATCH_SIZE || '50', 10),

  downloadDelay: 100,
  uploadDelay: 50,

  stateFile: './blob-migration-state.json',
  reportFile: './blob-migration-report.json',
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

function isCosmicUrl(url) {
  if (!url) return false;
  return (
    url.includes('imgix.cosmicjs.com') ||
    url.includes('cdn.cosmicjs.com') ||
    url.includes('cosmic-s3.imgix.net')
  );
}

function isVercelBlobUrl(url) {
  if (!url) return false;
  return (
    url.includes('.public.blob.vercel-storage.com') || url.includes('.blob.vercel-storage.com')
  );
}

function generateBlobPath(slug, originalFilename) {
  const ext = (originalFilename || 'image.jpg').split('.').pop()?.toLowerCase() || 'jpg';
  return `episodes/${slug}.${ext}`;
}

async function existsInBlob(pathname) {
  if (!blobConfigured) return false;

  try {
    const result = await head(pathname);
    return !!result;
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

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType, size: buffer.length };
}

async function findCosmicMediaByUrl(imageUrl) {
  try {
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1].split('?')[0];

    let skip = 0;
    const limit = 100;

    while (true) {
      const response = await cosmic.media
        .find()
        .props(['id', 'name', 'url', 'imgix_url'])
        .limit(limit)
        .skip(skip);

      const media = response.media || [];
      if (media.length === 0) break;

      for (const item of media) {
        if (
          item.url === imageUrl ||
          item.imgix_url === imageUrl ||
          item.name === filename ||
          item.url?.includes(filename) ||
          item.imgix_url?.includes(filename)
        ) {
          return item;
        }
      }

      if (media.length < limit) break;
      skip += limit;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function fetchAllEpisodes() {
  console.log('\n📄 Fetching all episodes (sorted by broadcast date)...');
  const allEpisodes = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await cosmic.objects
        .find({ type: 'episode' })
        .props('id,slug,title,metadata.image,metadata.broadcast_date')
        .sort('-metadata.broadcast_date')
        .limit(CONFIG.batchSize)
        .skip(skip)
        .status('any');

      const episodes = response.objects || [];
      allEpisodes.push(...episodes);

      if (allEpisodes.length % 500 === 0) {
        console.log(`  ... ${allEpisodes.length} episodes fetched`);
      }

      hasMore = episodes.length === CONFIG.batchSize;
      skip += CONFIG.batchSize;
    } catch (error) {
      if (error?.message?.includes('No objects found')) {
        hasMore = false;
      } else {
        console.error(`  ⚠️  Error at skip=${skip}: ${error.message}`);
        await sleep(2000);
        try {
          const response = await cosmic.objects
            .find({ type: 'episode' })
            .props('id,slug,title,metadata.image,metadata.broadcast_date')
            .sort('-metadata.broadcast_date')
            .limit(CONFIG.batchSize)
            .skip(skip)
            .status('any');

          const episodes = response.objects || [];
          allEpisodes.push(...episodes);
          hasMore = episodes.length === CONFIG.batchSize;
          skip += CONFIG.batchSize;
        } catch (retryError) {
          console.error(`  ❌ Retry failed, stopping at ${allEpisodes.length} episodes`);
          hasMore = false;
        }
      }
    }
  }

  console.log(`  ✅ Total episodes: ${allEpisodes.length}`);
  return allEpisodes;
}

function identifyMigrationCandidates(episodes) {
  console.log(`\n🔍 Identifying migration candidates (position > ${CONFIG.hotStorageLimit})...`);

  const hotEpisodes = episodes.slice(0, CONFIG.hotStorageLimit);
  const coldEpisodes = episodes.slice(CONFIG.hotStorageLimit);

  console.log(
    `  🔥 Hot storage (latest ${CONFIG.hotStorageLimit}): ${hotEpisodes.length} episodes`
  );
  console.log(`  ❄️  Cold storage candidates: ${coldEpisodes.length} episodes`);

  const needsMigration = coldEpisodes.filter(ep => {
    const imageUrl = ep.metadata?.image?.url || ep.metadata?.image?.imgix_url;
    return imageUrl && isCosmicUrl(imageUrl);
  });

  const alreadyMigrated = coldEpisodes.filter(ep => {
    const imageUrl = ep.metadata?.image?.url || ep.metadata?.image?.imgix_url;
    return imageUrl && isVercelBlobUrl(imageUrl);
  });

  const noImage = coldEpisodes.filter(ep => {
    return !ep.metadata?.image?.url && !ep.metadata?.image?.imgix_url;
  });

  console.log(`\n  📋 Cold storage breakdown:`);
  console.log(`    - Need migration (Cosmic): ${needsMigration.length}`);
  console.log(`    - Already migrated (Blob): ${alreadyMigrated.length}`);
  console.log(`    - No image: ${noImage.length}`);

  return { hotEpisodes, coldEpisodes, needsMigration, alreadyMigrated, noImage };
}

async function migrateEpisodeImage(episode, index, total) {
  const imageUrl = episode.metadata?.image?.url || episode.metadata?.image?.imgix_url;
  const imageName = episode.metadata?.image?.name || imageUrl?.split('/').pop()?.split('?')[0];
  const blobPath = generateBlobPath(episode.slug, imageName);

  console.log(`\n  [${index + 1}/${total}] ${episode.title}`);
  console.log(`    Slug: ${episode.slug}`);

  if (CONFIG.dryRun) {
    console.log(`    ⏭️  DRY RUN - Would migrate to Vercel Blob`);
    return { success: true, dryRun: true };
  }

  try {
    const existsAlready = await existsInBlob(blobPath);
    let blobUrl;
    let bytesUploaded = 0;

    if (existsAlready) {
      console.log(`    ✅ Already in Blob, updating Cosmic metadata...`);
      const headResult = await head(blobPath);
      blobUrl = headResult.url;
    } else {
      console.log(`    ⬇️  Downloading from Cosmic...`);
      const { buffer, contentType, size } = await downloadImage(imageUrl);
      bytesUploaded = size;
      console.log(`    📦 Size: ${formatBytes(size)}`);

      await sleep(CONFIG.downloadDelay);

      console.log(`    ⬆️  Uploading to Vercel Blob...`);
      blobUrl = await uploadToBlob(blobPath, buffer, contentType);

      await sleep(CONFIG.uploadDelay);
    }

    console.log(`    📝 Updating Cosmic metadata...`);
    await cosmic.objects.updateOne(episode.id, {
      metadata: {
        external_image_url: blobUrl,
      },
    });

    console.log(`    🗑️  Deleting from Cosmic media...`);
    const cosmicMedia = await findCosmicMediaByUrl(imageUrl);

    let cosmicMediaDeleted = false;
    if (cosmicMedia) {
      try {
        await cosmic.media.deleteOne(cosmicMedia.id);
        cosmicMediaDeleted = true;
        console.log(`    ✅ Deleted Cosmic media: ${cosmicMedia.name}`);
      } catch (deleteError) {
        console.log(`    ⚠️  Could not delete: ${deleteError.message}`);
      }
    } else {
      console.log(`    ⚠️  Cosmic media not found (may already be deleted)`);
    }

    console.log(`    ✅ Migrated to: ${blobUrl}`);
    return { success: true, blobUrl, cosmicMediaDeleted, bytesUploaded };
  } catch (error) {
    console.log(`    ❌ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Episode Image Cold Storage Migration');
  console.log('  Cosmic → Vercel Blob');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Cosmic Bucket: ${CONFIG.bucketSlug}`);
  console.log(`  Hot Storage Limit: ${CONFIG.hotStorageLimit} episodes`);
  console.log(`  Mode: ${CONFIG.dryRun ? '🏃 DRY RUN (preview only)' : '🚀 LIVE (will migrate)'}`);
  console.log(`  Vercel Blob: ${blobConfigured ? '✅ Configured' : '⚠️ Not configured'}`);
  console.log('═══════════════════════════════════════════════════════════');

  const startTime = Date.now();
  saveState({ phase: 'starting' });

  try {
    const episodes = await fetchAllEpisodes();

    if (episodes.length === 0) {
      console.log('\n❌ No episodes found');
      return;
    }

    saveState({ phase: 'episodes_fetched', count: episodes.length });

    const { hotEpisodes, coldEpisodes, needsMigration, alreadyMigrated, noImage } =
      identifyMigrationCandidates(episodes);

    saveState({
      phase: 'candidates_identified',
      hot: hotEpisodes.length,
      cold: coldEpisodes.length,
      needsMigration: needsMigration.length,
    });

    const estimatedBytes = needsMigration.length * 350 * 1024; // ~350KB average
    console.log(`\n  💾 Estimated storage needed: ${formatBytes(estimatedBytes)}`);
    console.log(`  📊 Vercel Pro includes 5 GB (you have room for ~14,500 images)`);

    if (needsMigration.length === 0) {
      console.log('\n✅ No episodes need migration - all cold storage images already migrated!');
      return;
    }

    console.log(`\n🚀 Starting migration of ${needsMigration.length} episodes...`);

    const results = {
      migrated: 0,
      failed: 0,
      skipped: 0,
      bytesUploaded: 0,
      cosmicMediaDeleted: 0,
      errors: [],
    };

    for (let i = 0; i < needsMigration.length; i++) {
      const episode = needsMigration[i];
      const result = await migrateEpisodeImage(episode, i, needsMigration.length);

      if (result.success) {
        if (result.dryRun) {
          results.skipped++;
        } else {
          results.migrated++;
          results.bytesUploaded += result.bytesUploaded || 0;
          if (result.cosmicMediaDeleted) {
            results.cosmicMediaDeleted++;
          }
        }
      } else {
        results.failed++;
        results.errors.push({
          episode: episode.title,
          slug: episode.slug,
          error: result.error,
        });
      }

      if ((i + 1) % 50 === 0) {
        saveState({
          phase: 'migrating',
          progress: i + 1,
          total: needsMigration.length,
          ...results,
        });
        console.log(
          `\n  📊 Progress: ${i + 1}/${needsMigration.length} (${formatBytes(results.bytesUploaded)} uploaded)`
        );
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Total episodes: ${episodes.length}`);
    console.log(`  Hot storage (kept on Cosmic): ${hotEpisodes.length}`);
    console.log(`  Cold storage: ${coldEpisodes.length}`);
    console.log(`    - Previously migrated: ${alreadyMigrated.length}`);
    console.log(`    - No image: ${noImage.length}`);
    console.log(`    - Processed this run: ${needsMigration.length}`);

    if (CONFIG.dryRun) {
      console.log(`\n  🏃 DRY RUN RESULTS:`);
      console.log(`    Would migrate: ${results.skipped} episodes`);
    } else {
      console.log(`\n  🚀 MIGRATION RESULTS:`);
      console.log(`    Successfully migrated: ${results.migrated}`);
      console.log(`    Bytes uploaded to Blob: ${formatBytes(results.bytesUploaded)}`);
      console.log(`    Cosmic media deleted: ${results.cosmicMediaDeleted}`);
      console.log(`    Failed: ${results.failed}`);
    }
    console.log('═══════════════════════════════════════════════════════════');

    const report = {
      timestamp: new Date().toISOString(),
      dryRun: CONFIG.dryRun,
      hotStorageLimit: CONFIG.hotStorageLimit,
      cosmicBucket: CONFIG.bucketSlug,
      stats: {
        totalEpisodes: episodes.length,
        hotStorage: hotEpisodes.length,
        coldStorage: coldEpisodes.length,
        alreadyMigrated: alreadyMigrated.length,
        noImage: noImage.length,
        needsMigration: needsMigration.length,
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
