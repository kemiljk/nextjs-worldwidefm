#!/usr/bin/env node

/**
 * Cosmic Media Cleanup Script (Safe Mode)
 *
 * Identifies and optionally deletes unused media from a CosmicJS bucket.
 * Includes safety guarantees to prevent accidental deletion of used media.
 *
 * Usage:
 *   DRY_RUN=true bun run scripts/cleanup-cosmic-media.mjs   # Preview (default)
 *   DRY_RUN=false bun run scripts/cleanup-cosmic-media.mjs  # Actually delete
 *
 * Environment variables:
 *   COSMIC_BUCKET_SLUG or NEXT_PUBLIC_COSMIC_BUCKET_SLUG
 *   COSMIC_READ_KEY or NEXT_PUBLIC_COSMIC_READ_KEY
 *   COSMIC_WRITE_KEY
 *
 *   DRY_RUN             - "true" (default) or "false"
 *   EXPORT_MEDIA        - "true" (default) or "false" - Export unused media before deletion
 *   EXPORT_DIR          - Directory to export media (default: ./cosmic-media-backup)
 *
 *   MIN_EPISODES        - Minimum episodes required to proceed (default: 10000)
 *   MIN_USED_RATIO      - Minimum ratio of used media (default: 0.1 = 10%)
 *   BATCH_SIZE          - Objects per page for large collections (default: 50)
 */

import { createBucketClient } from '@cosmicjs/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  bucketSlug: process.env.COSMIC_BUCKET_SLUG || process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
  dryRun: process.env.DRY_RUN !== 'false',
  exportMedia: process.env.EXPORT_MEDIA !== 'false',
  exportDir: process.env.EXPORT_DIR || path.join(__dirname, '..', 'cosmic-media-backup'),

  // Safety thresholds
  minEpisodes: parseInt(process.env.MIN_EPISODES || '10000', 10),
  minUsedRatio: parseFloat(process.env.MIN_USED_RATIO || '0.1'),

  // Fetching settings
  mediaLimit: 100,
  batchSize: parseInt(process.env.BATCH_SIZE || '50', 10),
  largeBatchSize: 50, // For large collections like episodes
  maxRetries: 3,
  retryDelayBase: 1000,

  // Rate limiting
  deleteDelay: 200,
  downloadDelay: 100,

  // Files
  stateFile: './cosmic-cleanup-state.json',
  reportFile: './cosmic-cleanup-report.json',
  manifestFile: 'manifest.json',
};

// Validate required env vars
if (!CONFIG.bucketSlug || !CONFIG.readKey || !CONFIG.writeKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  COSMIC_BUCKET_SLUG (or NEXT_PUBLIC_COSMIC_BUCKET_SLUG)');
  console.error('  COSMIC_READ_KEY (or NEXT_PUBLIC_COSMIC_READ_KEY)');
  console.error('  COSMIC_WRITE_KEY');
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: CONFIG.bucketSlug,
  readKey: CONFIG.readKey,
  writeKey: CONFIG.writeKey,
});

// Known image fields to check explicitly
const IMAGE_FIELDS = [
  'image',
  'thumbnail',
  'og_image',
  'hero_image',
  'story_image',
  'video_thumbnail',
  'youtube_video_thumbnail',
  'direct_video',
  'video',
  'playlist_image',
];

// Array fields that may contain images
const IMAGE_ARRAY_FIELDS = ['image_gallery', 'heroItems'];

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry(fn, context, maxRetries = CONFIG.maxRetries) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isNotFound =
        error?.message?.includes('No objects found') ||
        error?.message?.includes('404') ||
        error?.status === 404;

      // Don't retry "not found" errors - they're valid responses
      if (isNotFound) {
        return { objects: [], media: [], total: 0 };
      }

      if (attempt < maxRetries) {
        const delay = CONFIG.retryDelayBase * Math.pow(2, attempt - 1);
        console.log(
          `    ⚠️  Attempt ${attempt}/${maxRetries} failed for ${context}: ${error?.message || 'Unknown error'}`
        );
        console.log(`    ⏳ Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Failed after ${maxRetries} attempts for ${context}: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Fetch all media with pagination and retry
 */
async function fetchAllMedia() {
  console.log('\n📷 Fetching all media...');
  const allMedia = [];
  let skip = 0;
  let hasMore = true;
  let total = 0;

  while (hasMore) {
    const response = await withRetry(async () => {
      return await cosmic.media
        .find()
        .props(['id', 'name', 'url', 'imgix_url', 'original_name', 'size', 'folder'])
        .limit(CONFIG.mediaLimit)
        .skip(skip);
    }, `media at skip=${skip}`);

    const media = response.media || [];
    allMedia.push(...media);

    if (response.total) {
      total = response.total;
    }

    console.log(`  Fetched ${allMedia.length} / ${total || '?'} media items`);

    hasMore = media.length === CONFIG.mediaLimit;
    skip += CONFIG.mediaLimit;
  }

  console.log(`  ✅ Total media items: ${allMedia.length}`);
  return allMedia;
}

/**
 * Fetch all object types
 */
async function fetchObjectTypes() {
  console.log('\n📦 Fetching object types...');

  const response = await withRetry(async () => cosmic.objectTypes.find(), 'object types');

  const types = response.object_types || [];
  console.log(`  ✅ Found ${types.length} object types: ${types.map(t => t.slug).join(', ')}`);
  return types;
}

/**
 * Fetch all objects for a given type with pagination and retry
 * Uses smaller batch sizes for large collections
 */
async function fetchObjectsByType(typeSlug) {
  const allObjects = [];
  let skip = 0;
  let hasMore = true;

  // Use smaller batch size for large collections
  const isLargeCollection = ['episode', 'episodes'].includes(typeSlug);
  const batchSize = isLargeCollection ? CONFIG.largeBatchSize : CONFIG.batchSize;

  while (hasMore) {
    const response = await withRetry(async () => {
      return await cosmic.objects
        .find({ type: typeSlug })
        .limit(batchSize)
        .skip(skip)
        .depth(2)
        .status('any');
    }, `${typeSlug} at skip=${skip}`);

    const objects = response.objects || [];
    allObjects.push(...objects);

    hasMore = objects.length === batchSize;
    skip += batchSize;

    // Progress indicator for large collections
    if (isLargeCollection && allObjects.length > 0 && allObjects.length % 500 === 0) {
      console.log(`    ... ${allObjects.length} ${typeSlug} fetched so far`);
    }
  }

  return allObjects;
}

/**
 * Fetch all objects across all types with validation
 */
async function fetchAllObjects(objectTypes) {
  console.log('\n📄 Fetching all objects...');
  const allObjects = [];
  const typeCounts = {};

  for (const type of objectTypes) {
    try {
      const objects = await fetchObjectsByType(type.slug);
      allObjects.push(...objects);
      typeCounts[type.slug] = objects.length;

      const isCritical = type.slug === 'episode' ? ' [CRITICAL]' : '';
      console.log(`  ${type.slug}: ${objects.length} objects${isCritical}`);
    } catch (error) {
      console.error(`  ❌ FAILED to fetch ${type.slug}: ${error.message}`);
      typeCounts[type.slug] = -1; // Mark as failed
    }
  }

  console.log(`  ✅ Total objects: ${allObjects.length}`);
  return { allObjects, typeCounts };
}

/**
 * Extract image references from an object
 * Returns a Set of all identifiers (id, name, url, imgix_url) found
 */
function extractImageReferences(obj, depth = 0) {
  const references = new Set();

  if (!obj || typeof obj !== 'object' || depth > 10) {
    return references;
  }

  // Check if this looks like an image object
  if (obj.url || obj.imgix_url) {
    if (obj.id) references.add(obj.id);
    if (obj.name) references.add(obj.name);
    if (obj.url) {
      references.add(obj.url);
      // Also extract filename from URL
      const filename = obj.url.split('/').pop()?.split('?')[0];
      if (filename) references.add(filename);
    }
    if (obj.imgix_url) {
      references.add(obj.imgix_url);
      // Also extract filename from imgix URL
      const filename = obj.imgix_url.split('/').pop()?.split('?')[0];
      if (filename) references.add(filename);
    }
  }

  // Check known image fields
  for (const field of IMAGE_FIELDS) {
    if (obj[field]) {
      const fieldRefs = extractImageReferences(obj[field], depth + 1);
      fieldRefs.forEach(ref => references.add(ref));
    }
  }

  // Check image array fields
  for (const field of IMAGE_ARRAY_FIELDS) {
    if (Array.isArray(obj[field])) {
      for (const item of obj[field]) {
        if (item?.image) {
          const itemRefs = extractImageReferences(item.image, depth + 1);
          itemRefs.forEach(ref => references.add(ref));
        } else {
          const itemRefs = extractImageReferences(item, depth + 1);
          itemRefs.forEach(ref => references.add(ref));
        }
      }
    }
  }

  // Check metadata object specifically
  if (obj.metadata && typeof obj.metadata === 'object') {
    const metaRefs = extractImageReferences(obj.metadata, depth + 1);
    metaRefs.forEach(ref => references.add(ref));
  }

  // Check thumbnail field (can be string or object)
  if (obj.thumbnail) {
    if (typeof obj.thumbnail === 'string') {
      references.add(obj.thumbnail);
    } else {
      const thumbRefs = extractImageReferences(obj.thumbnail, depth + 1);
      thumbRefs.forEach(ref => references.add(ref));
    }
  }

  // Check seo object for og_image
  if (obj.seo?.og_image) {
    const seoRefs = extractImageReferences(obj.seo.og_image, depth + 1);
    seoRefs.forEach(ref => references.add(ref));
  }

  return references;
}

/**
 * Build a comprehensive index of all media identifiers
 */
function buildMediaIndex(allMedia) {
  const index = {
    byId: new Map(),
    byName: new Map(),
    byUrl: new Map(),
    byImgixUrl: new Map(),
    byFilename: new Map(),
  };

  for (const media of allMedia) {
    if (media.id) index.byId.set(media.id, media);
    if (media.name) {
      index.byName.set(media.name, media);
      // Also index without UUID prefix if present
      const nameWithoutUuid = media.name.replace(/^[a-f0-9-]{36}-/i, '');
      if (nameWithoutUuid !== media.name) {
        index.byFilename.set(nameWithoutUuid, media);
      }
    }
    if (media.url) {
      index.byUrl.set(media.url, media);
      const filename = media.url.split('/').pop()?.split('?')[0];
      if (filename) index.byFilename.set(filename, media);
    }
    if (media.imgix_url) {
      index.byImgixUrl.set(media.imgix_url, media);
      const filename = media.imgix_url.split('/').pop()?.split('?')[0];
      if (filename) index.byFilename.set(filename, media);
    }
  }

  return index;
}

/**
 * Check if a media item is referenced by any identifier
 */
function isMediaReferenced(media, allReferences) {
  const identifiers = [
    media.id,
    media.name,
    media.url,
    media.imgix_url,
    media.original_name,
  ].filter(Boolean);

  // Also check filename variations
  if (media.url) {
    const filename = media.url.split('/').pop()?.split('?')[0];
    if (filename) identifiers.push(filename);
  }
  if (media.imgix_url) {
    const filename = media.imgix_url.split('/').pop()?.split('?')[0];
    if (filename) identifiers.push(filename);
  }
  if (media.name) {
    // Check name without UUID prefix
    const nameWithoutUuid = media.name.replace(/^[a-f0-9-]{36}-/i, '');
    if (nameWithoutUuid !== media.name) {
      identifiers.push(nameWithoutUuid);
    }
  }

  return identifiers.some(id => allReferences.has(id));
}

/**
 * Analyze which media is in use
 */
function analyzeMediaUsage(allMedia, allObjects) {
  console.log('\n🔍 Analyzing media usage...');
  console.log(`  Scanning ${allObjects.length} objects for image references...`);

  // Extract all image references from all objects
  const allReferences = new Set();

  for (const obj of allObjects) {
    const refs = extractImageReferences(obj);
    refs.forEach(ref => allReferences.add(ref));
  }

  console.log(`  Found ${allReferences.size} unique image references`);

  // Categorize media
  const usedMedia = [];
  const unusedMedia = [];

  for (const media of allMedia) {
    if (isMediaReferenced(media, allReferences)) {
      usedMedia.push(media);
    } else {
      unusedMedia.push(media);
    }
  }

  const usedRatio = usedMedia.length / allMedia.length;
  console.log(`  ✅ Used media: ${usedMedia.length} (${(usedRatio * 100).toFixed(1)}%)`);
  console.log(`  ⚠️  Unused media: ${unusedMedia.length} (${((1 - usedRatio) * 100).toFixed(1)}%)`);

  return { usedMedia, unusedMedia, allReferences, usedRatio };
}

/**
 * Validate safety thresholds
 */
function validateSafetyThresholds(typeCounts, usedRatio, allMedia) {
  console.log('\n🛡️  Validating safety thresholds...');

  const errors = [];
  const warnings = [];

  // Check episode count
  const episodeCount = typeCounts['episode'] || 0;
  if (episodeCount < 0) {
    errors.push(`Episode fetch FAILED - cannot proceed safely`);
  } else if (episodeCount < CONFIG.minEpisodes) {
    errors.push(`Episode count (${episodeCount}) is below threshold (${CONFIG.minEpisodes})`);
  } else {
    console.log(`  ✅ Episodes fetched: ${episodeCount} >= ${CONFIG.minEpisodes} threshold`);
  }

  // Check used media ratio
  if (usedRatio < CONFIG.minUsedRatio) {
    errors.push(
      `Used media ratio (${(usedRatio * 100).toFixed(1)}%) is below threshold (${(CONFIG.minUsedRatio * 100).toFixed(0)}%)`
    );
  } else {
    console.log(
      `  ✅ Used media ratio: ${(usedRatio * 100).toFixed(1)}% >= ${(CONFIG.minUsedRatio * 100).toFixed(0)}% threshold`
    );
  }

  // Warn if too many media marked as unused
  const unusedRatio = 1 - usedRatio;
  if (unusedRatio > 0.5) {
    warnings.push(`More than 50% of media marked as unused - please verify`);
  }

  if (errors.length > 0) {
    console.log('\n❌ SAFETY CHECK FAILED:');
    errors.forEach(e => console.log(`  - ${e}`));
    return false;
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  console.log('\n✅ SAFETY CHECK PASSED');
  return true;
}

/**
 * Sanitize filename for filesystem
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 255);
}

/**
 * Download a single media file
 */
async function downloadMediaFile(media, exportPath) {
  const url = media.url || media.imgix_url;
  if (!url) {
    throw new Error('No URL available for media');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(exportPath, buffer);
  return buffer.length;
}

/**
 * Export unused media to local filesystem
 */
async function exportUnusedMedia(unusedMedia) {
  if (!CONFIG.exportMedia) {
    console.log('\n📦 Media export disabled (set EXPORT_MEDIA=true to enable)');
    return { exported: 0, failed: 0, totalBytes: 0 };
  }

  console.log(`\n💾 Exporting ${unusedMedia.length} unused media files...`);
  console.log(`  Export location: ${CONFIG.exportDir}`);

  if (!fs.existsSync(CONFIG.exportDir)) {
    fs.mkdirSync(CONFIG.exportDir, { recursive: true });
  }

  let exported = 0;
  let failed = 0;
  let totalBytes = 0;
  const manifest = [];
  const failedFiles = [];

  for (let i = 0; i < unusedMedia.length; i++) {
    const media = unusedMedia[i];
    try {
      const filename = media.original_name || media.name || `${media.id}.bin`;
      const sanitizedFilename = sanitizeFilename(filename);

      let filePath;
      if (media.folder) {
        const folderPath = path.join(CONFIG.exportDir, sanitizeFilename(media.folder));
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        filePath = path.join(folderPath, sanitizedFilename);
      } else {
        filePath = path.join(CONFIG.exportDir, sanitizedFilename);
      }

      // Handle filename collisions
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        const dir = path.dirname(filePath);
        filePath = path.join(dir, `${base}_${media.id.slice(-8)}${ext}`);
      }

      const fileSize = await downloadMediaFile(media, filePath);
      totalBytes += fileSize;
      exported++;

      manifest.push({
        id: media.id,
        name: media.name,
        originalName: media.original_name,
        size: media.size,
        folder: media.folder,
        localPath: path.relative(CONFIG.exportDir, filePath),
        url: media.url,
        imgixUrl: media.imgix_url,
      });

      if ((i + 1) % 50 === 0 || i + 1 === unusedMedia.length) {
        console.log(
          `  [${i + 1}/${unusedMedia.length}] Exported ${exported} files (${formatBytes(totalBytes)})`
        );
      }

      await sleep(CONFIG.downloadDelay);
    } catch (error) {
      failed++;
      failedFiles.push({
        id: media.id,
        name: media.name,
        url: media.url,
        error: error.message,
      });

      if (failed <= 5) {
        console.error(`  ⚠️  Failed: ${media.name || media.id} - ${error.message}`);
      } else if (failed === 6) {
        console.error(`  ... suppressing further error messages`);
      }
    }
  }

  // Save manifest
  const manifestPath = path.join(CONFIG.exportDir, CONFIG.manifestFile);
  const fullManifest = {
    timestamp: new Date().toISOString(),
    bucket: CONFIG.bucketSlug,
    totalExported: exported,
    totalFailed: failed,
    totalBytes: totalBytes,
    files: manifest,
    failedFiles: failedFiles,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(fullManifest, null, 2));

  if (failedFiles.length > 0) {
    const failedPath = path.join(CONFIG.exportDir, 'failed-exports.json');
    fs.writeFileSync(failedPath, JSON.stringify(failedFiles, null, 2));
  }

  console.log(`\n  ✅ Export complete: ${exported} files (${formatBytes(totalBytes)})`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} files failed to export`);
  }
  console.log(`  📝 Manifest saved: ${manifestPath}`);

  return { exported, failed, totalBytes, manifest };
}

/**
 * Delete unused media from Cosmic
 */
async function deleteUnusedMedia(unusedMedia, exportResult) {
  if (CONFIG.dryRun) {
    console.log('\n🏃 DRY RUN - No media will be deleted');
    console.log('  Set DRY_RUN=false to actually delete');
    return { deleted: 0, failed: 0 };
  }

  // Verify export completed successfully before deletion
  if (CONFIG.exportMedia && exportResult.exported < unusedMedia.length * 0.9) {
    console.log('\n❌ ABORTING DELETION: Export did not complete successfully');
    console.log(`  Exported: ${exportResult.exported} / ${unusedMedia.length}`);
    console.log('  At least 90% of files must be exported before deletion can proceed');
    return { deleted: 0, failed: 0 };
  }

  console.log('\n🗑️  Deleting unused media...');
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < unusedMedia.length; i++) {
    const media = unusedMedia[i];
    try {
      await cosmic.media.deleteOne(media.id);
      deleted++;

      if ((i + 1) % 50 === 0 || i + 1 === unusedMedia.length) {
        console.log(`  [${i + 1}/${unusedMedia.length}] Deleted ${deleted} files`);
      }

      // Save progress periodically
      if (deleted % 100 === 0) {
        saveState({ phase: 'deletion', lastDeletedIndex: i, deleted, failed });
      }

      await sleep(CONFIG.deleteDelay);
    } catch (error) {
      failed++;
      if (failed <= 5) {
        console.error(`  ⚠️  Failed to delete: ${media.name || media.id} - ${error.message}`);
      }
    }
  }

  return { deleted, failed };
}

/**
 * Save state for resumability
 */
function saveState(state) {
  try {
    fs.writeFileSync(
      CONFIG.stateFile,
      JSON.stringify({ ...state, timestamp: new Date().toISOString() }, null, 2)
    );
  } catch (error) {
    // Non-critical
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Cosmic Media Cleanup Script (Safe Mode)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Bucket: ${CONFIG.bucketSlug}`);
  console.log(`  Mode: ${CONFIG.dryRun ? '🏃 DRY RUN (preview only)' : '🗑️  LIVE (will delete)'}`);
  console.log(
    `  Safety: MIN_EPISODES=${CONFIG.minEpisodes}, MIN_USED_RATIO=${(CONFIG.minUsedRatio * 100).toFixed(0)}%`
  );
  console.log(`  Export: ${CONFIG.exportMedia ? CONFIG.exportDir : 'disabled'}`);
  console.log('═══════════════════════════════════════════════════════════');

  const startTime = Date.now();
  saveState({ phase: 'starting' });

  try {
    // Phase 1: Fetch all media
    const allMedia = await fetchAllMedia();
    if (allMedia.length === 0) {
      console.log('\n✅ No media found in bucket. Nothing to clean up.');
      return;
    }
    saveState({ phase: 'media_fetched', mediaCount: allMedia.length });

    // Phase 2: Fetch all object types
    const objectTypes = await fetchObjectTypes();
    if (objectTypes.length === 0) {
      console.log('\n❌ ABORTING: No object types found');
      return;
    }

    // Phase 3: Fetch all objects with validation
    const { allObjects, typeCounts } = await fetchAllObjects(objectTypes);
    saveState({ phase: 'objects_fetched', objectCount: allObjects.length, typeCounts });

    // Phase 4: Analyze usage
    const { usedMedia, unusedMedia, usedRatio } = analyzeMediaUsage(allMedia, allObjects);
    saveState({
      phase: 'analysis_complete',
      usedCount: usedMedia.length,
      unusedCount: unusedMedia.length,
    });

    // Phase 5: Validate safety thresholds
    const safetyPassed = validateSafetyThresholds(typeCounts, usedRatio, allMedia);
    if (!safetyPassed) {
      console.log('\n❌ ABORTING: Safety thresholds not met');
      console.log('  This likely indicates a data fetching issue.');
      console.log('  Please investigate before proceeding.');
      process.exit(1);
    }

    // Phase 6: Calculate stats
    const unusedBytes = unusedMedia.reduce((sum, m) => sum + (parseInt(m.size) || 0), 0);
    const totalBytes = allMedia.reduce((sum, m) => sum + (parseInt(m.size) || 0), 0);

    // Phase 7: Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Total media:      ${allMedia.length} (${formatBytes(totalBytes)})`);
    console.log(`  Used media:       ${usedMedia.length}`);
    console.log(`  Unused media:     ${unusedMedia.length} (${formatBytes(unusedBytes)})`);
    console.log(`  Potential savings: ${formatBytes(unusedBytes)}`);
    console.log('═══════════════════════════════════════════════════════════');

    // Save full report
    const report = {
      timestamp: new Date().toISOString(),
      bucket: CONFIG.bucketSlug,
      dryRun: CONFIG.dryRun,
      safetyPassed: true,
      thresholds: {
        minEpisodes: CONFIG.minEpisodes,
        minUsedRatio: CONFIG.minUsedRatio,
        actualEpisodes: typeCounts['episode'] || 0,
        actualUsedRatio: usedRatio,
      },
      stats: {
        totalMedia: allMedia.length,
        totalBytes,
        usedMedia: usedMedia.length,
        unusedMedia: unusedMedia.length,
        unusedBytes,
        typeCounts,
      },
      usedMediaIds: usedMedia.map(m => ({ id: m.id, name: m.name })),
      unusedMediaDetails: unusedMedia.map(m => ({
        id: m.id,
        name: m.name,
        size: m.size,
        folder: m.folder,
        url: m.url,
      })),
    };
    fs.writeFileSync(CONFIG.reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📝 Full report saved to: ${CONFIG.reportFile}`);

    // Phase 8: Export unused media
    let exportResult = { exported: 0, failed: 0, totalBytes: 0 };
    if (unusedMedia.length > 0 && CONFIG.exportMedia) {
      exportResult = await exportUnusedMedia(unusedMedia);
      saveState({ phase: 'export_complete', ...exportResult });
    }

    // Phase 9: Delete if not dry run
    if (unusedMedia.length > 0) {
      const { deleted, failed } = await deleteUnusedMedia(unusedMedia, exportResult);

      if (!CONFIG.dryRun && deleted > 0) {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  DELETION RESULTS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`  Successfully deleted: ${deleted}`);
        console.log(`  Failed: ${failed}`);
        console.log(`  Space freed: ~${formatBytes(unusedBytes)}`);
        console.log('═══════════════════════════════════════════════════════════');
        saveState({ phase: 'deletion_complete', deleted, failed });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Completed in ${elapsed}s`);
    saveState({ phase: 'complete', elapsed });
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    saveState({ phase: 'error', error: error.message });
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
