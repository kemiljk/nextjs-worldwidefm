const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");

const config = {
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
};

// Validate configuration
if (!config.cosmic.bucketSlug || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration:");
  if (!config.cosmic.bucketSlug) console.error("- NEXT_PUBLIC_COSMIC_BUCKET_SLUG is not set");
  if (!config.cosmic.writeKey) console.error("- COSMIC_WRITE_KEY is not set");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function getEpisodesWithBrokenImages() {
  try {
    console.log("🔍 Finding episodes with broken image references...");

    // Get all episodes that were migrated from Craft
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      props: "id,title,slug,metadata,thumbnail",
    });

    const episodes = response.objects || [];
    console.log(`✅ Found ${episodes.length} migrated episodes`);

    // Filter episodes that have image as just an ID (string) instead of full object
    const brokenEpisodes = episodes.filter(episode => {
      const image = episode.metadata?.image;
      return image && typeof image === 'string' && image.length > 10; // Likely an ID
    });

    console.log(`🔍 Found ${brokenEpisodes.length} episodes with broken image references`);
    return brokenEpisodes;
  } catch (error) {
    console.error("❌ Error finding episodes:", error.message);
    return [];
  }
}

async function getMediaById(mediaId) {
  try {
    const response = await cosmic.media.findOne(mediaId);
    return response.media || null;
  } catch (error) {
    console.error(`❌ Error fetching media ${mediaId}:`, error.message);
    return null;
  }
}

async function fixEpisodeImage(episode) {
  try {
    console.log(`🔧 Fixing episode: ${episode.title}`);
    
    const currentImage = episode.metadata?.image;
    if (!currentImage || typeof currentImage !== 'string') {
      console.log(`   ⚠️ Episode doesn't have a broken image reference`);
      return false;
    }

    // Get the full media object
    const mediaItem = await getMediaById(currentImage);
    if (!mediaItem) {
      console.log(`   ❌ Could not find media item with ID: ${currentImage}`);
      return false;
    }

    console.log(`   📸 Found media: ${mediaItem.original_name}`);

    // Update the episode with the correct media reference
    const updateData = {
      metadata: {
        ...episode.metadata,
        image: mediaItem.name, // Use the media name, not the full object
      },
    };

    const result = await cosmic.objects.updateOne(episode.id, updateData);
    
    if (result && result.object) {
      console.log(`   ✅ Successfully fixed image reference for: ${episode.title}`);
      return true;
    } else {
      console.log(`   ❌ Failed to update episode: ${episode.title}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error fixing episode ${episode.title}:`, error.message);
    return false;
  }
}

async function fixAllBrokenImages() {
  try {
    console.log("🎯 Starting image reference fix process...");

    const brokenEpisodes = await getEpisodesWithBrokenImages();
    
    if (brokenEpisodes.length === 0) {
      console.log("✅ No episodes with broken image references found");
      return;
    }

    let fixed = 0;
    let failed = 0;

    for (const episode of brokenEpisodes) {
      const success = await fixEpisodeImage(episode);
      if (success) {
        fixed++;
      } else {
        failed++;
      }
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Image Fix Summary:`);
    console.log(`   🎯 Total broken episodes: ${brokenEpisodes.length}`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Failed: ${failed}`);

  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

async function main() {
  console.log("🔧 Starting episode image reference fix process...");

  try {
    await fixAllBrokenImages();
    console.log("\n🎉 Image reference fix process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, fixAllBrokenImages };
