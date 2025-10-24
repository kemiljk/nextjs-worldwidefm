#!/usr/bin/env node

/**
 * Script to migrate episode images from Craft CMS URLs to Cosmic Media
 * This script processes episodes that were created by the cron job but don't have images yet
 *
 * Usage: node scripts/migrate-episode-images.js [--dry-run]
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { createBucketClient } = require('@cosmicjs/sdk');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Configuration
const config = {
  downloadDir: path.join(os.tmpdir(), 'episode-images'),
  batchSize: 10, // Process episodes in batches to avoid memory issues
  timeout: 30000, // 30 second timeout for downloads
};

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

async function downloadImage(imageUrl, filename) {
  try {
    // Ensure download directory exists
    await fs.mkdir(config.downloadDir, { recursive: true });

    const filepath = path.join(config.downloadDir, filename);

    // Check if file already exists
    try {
      await fs.access(filepath);
      console.log(`   📁 Image already exists: ${filename}`);
      return filepath;
    } catch {
      // File doesn't exist, download it
    }

    console.log(`   📥 Downloading: ${filename}`);
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: config.timeout,
    });

    await fs.writeFile(filepath, response.data);
    console.log(`   ✅ Downloaded: ${filename}`);
    return filepath;
  } catch (error) {
    console.error(`   ❌ Failed to download ${filename}:`, error.message);
    return null;
  }
}

async function uploadImageToCosmic(filepath, filename, title) {
  try {
    console.log(`   🚀 Uploading to Cosmic: ${filename}`);

    const fileBuffer = await fs.readFile(filepath);

    // Create a file-like object for Cosmic SDK
    const file = {
      originalname: filename,
      buffer: fileBuffer,
    };

    const response = await cosmic.media.insertOne({
      media: file,
    });

    if (response && response.media) {
      console.log(`   ✅ Uploaded to Cosmic: ${response.media.original_name}`);
      return response.media;
    } else {
      console.error(`   ❌ Invalid response from Cosmic for ${filename}`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Failed to upload ${filename} to Cosmic:`, error.message);
    return null;
  }
}

async function findEpisodesNeedingImages() {
  try {
    console.log('🔍 Finding episodes that need image processing...');

    const response = await cosmic.objects.find({
      type: 'episode',
      status: 'published',
      'metadata.source': 'migrated_from_craft',
      'metadata.craft_image_url': { $exists: true },
      limit: 1000,
      props: 'id,title,slug,metadata.craft_image_url,thumbnail,metadata.image',
    });

    const episodes = response.objects || [];
    console.log(`📊 Found ${episodes.length} episodes with craft_image_url`);

    // Filter out episodes that already have images
    const episodesNeedingImages = episodes.filter(episode => {
      const hasImage = episode.metadata?.image || episode.thumbnail;
      if (hasImage) {
        console.log(`   ⏭️ Skipping ${episode.title} - already has image`);
        return false;
      }
      return true;
    });

    console.log(`🎯 ${episodesNeedingImages.length} episodes need image processing`);
    return episodesNeedingImages;
  } catch (error) {
    console.error('❌ Error finding episodes:', error.message);
    return [];
  }
}

async function processEpisodeImage(episode) {
  try {
    console.log(`\n🎯 Processing image for: ${episode.title}`);

    const imageUrl = episode.metadata?.craft_image_url;
    if (!imageUrl) {
      console.log(`   ⚠️ No craft_image_url found for ${episode.title}`);
      return false;
    }

    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];

    if (!filename || !filename.includes('.')) {
      console.log(`   ⚠️ Could not extract valid filename from URL: ${imageUrl}`);
      return false;
    }

    console.log(`   📸 Processing image: ${filename}`);

    // Download the image
    const filepath = await downloadImage(imageUrl, filename);
    if (!filepath) {
      console.log(`   ❌ Failed to download image for ${episode.title}`);
      return false;
    }

    // Upload to Cosmic
    const mediaItem = await uploadImageToCosmic(filepath, filename, episode.title);
    if (!mediaItem) {
      console.log(`   ❌ Failed to upload image for ${episode.title}`);
      return false;
    }

    // Update the episode with the image
    const updateData = {
      metadata: {
        image: mediaItem.name, // Use the media name for image field
      },
      thumbnail: mediaItem.name, // thumbnail also uses the media name
    };

    // Remove the craft_image_url since we've processed it
    delete updateData.metadata.craft_image_url;

    await cosmic.objects.updateOne(episode.id, updateData);
    console.log(`   ✅ Successfully updated episode with image: ${episode.title}`);

    // Clean up the downloaded file
    try {
      await fs.unlink(filepath);
      console.log(`   🗑️ Cleaned up temporary file: ${filename}`);
    } catch (cleanupError) {
      console.log(`   ⚠️ Could not clean up temporary file: ${cleanupError.message}`);
    }

    return true;
  } catch (error) {
    console.error(`   ❌ Error processing image for ${episode.title}:`, error.message);
    return false;
  }
}

async function migrateEpisodeImages(dryRun = false) {
  try {
    console.log('🚀 Starting episode image migration...');
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No actual changes will be made');
    }

    const episodes = await findEpisodesNeedingImages();

    if (episodes.length === 0) {
      console.log('✅ No episodes need image processing');
      return;
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Process episodes in batches
    for (let i = 0; i < episodes.length; i += config.batchSize) {
      const batch = episodes.slice(i, i + config.batchSize);
      console.log(
        `\n📦 Processing batch ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(episodes.length / config.batchSize)}`
      );

      for (const episode of batch) {
        if (dryRun) {
          console.log(`   🔍 Would process image for: ${episode.title}`);
          console.log(`   📸 Image URL: ${episode.metadata?.craft_image_url}`);
          processed++;
          continue;
        }

        const success = await processEpisodeImage(episode);
        processed++;

        if (success) {
          successful++;
        } else {
          failed++;
        }

        // Small delay between episodes to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Longer delay between batches
      if (i + config.batchSize < episodes.length) {
        console.log(`   ⏳ Waiting 5 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   🎯 Total episodes: ${episodes.length}`);
    console.log(`   ✅ Successfully processed: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📦 Total processed: ${processed}`);

    if (dryRun) {
      console.log(`\n🔍 This was a dry run. Run without --dry-run to actually process images.`);
    }
  } catch (error) {
    console.error('❌ Error in migration process:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🎵 Episode Image Migration Script');
  console.log('=================================');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode');
  }

  await migrateEpisodeImages(dryRun);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateEpisodeImages };
