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

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function findEpisodesWithCorruptedImages() {
  try {
    console.log("🔍 Finding episodes with corrupted image URLs...");

    // Get all episodes that were migrated from Craft
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      limit: 1000,
      props: "id,title,slug,metadata,thumbnail"
    });

    if (!response || !response.objects) {
      console.error("No episodes found");
      return [];
    }

    console.log(`✅ Found ${response.objects.length} migrated episodes`);

    // Filter for episodes with corrupted image URLs
    // Corrupted URLs are missing the filename part
    const corruptedEpisodes = response.objects.filter(episode => {
      const image = episode.metadata?.image;
      if (!image || typeof image !== 'object') return false;
      
      const url = image.url;
      if (!url) return false;
      
      // Check if URL is corrupted (missing filename after the last dash)
      // Corrupted: "https://cdn.cosmicjs.com/20a16af0-6874-11f0-b3ac-450841c49653"
      // Correct: "https://cdn.cosmicjs.com/20a16af0-6874-11f0-b3ac-450841c49653-IMG_0289.jpg"
      const parts = url.split('-');
      return parts.length < 2 || !parts[parts.length - 1].includes('.');
    });

    console.log(`🔍 Found ${corruptedEpisodes.length} episodes with corrupted image URLs`);
    return corruptedEpisodes;

  } catch (error) {
    console.error("❌ Error finding episodes:", error.message);
    return [];
  }
}

async function extractFilenameFromUrl(url) {
  // Extract filename from corrupted URL
  // Example: "https://cdn.cosmicjs.com/20a16af0-6874-11f0-b3ac-450841c49653-IMG_0289.jpg"
  // We need to find the part after the last dash that contains a file extension
  
  const parts = url.split('-');
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.includes('.') && (part.includes('.jpg') || part.includes('.jpeg') || part.includes('.png') || part.includes('.gif') || part.includes('.webp'))) {
      return part;
    }
  }
  
  // Fallback: try to extract from the end of the URL
  const urlParts = url.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  if (lastPart.includes('.')) {
    return lastPart;
  }
  
  return null;
}

async function findMediaByFilename(filename) {
  try {
    // Search for media with this filename
    const response = await cosmic.media.find({
      query: { original_name: filename },
      limit: 1,
      props: "id,original_name,name,url,imgix_url"
    });

    if (response && response.media && response.media.length > 0) {
      return response.media[0];
    }

    // If not found by original_name, try searching by name
    const response2 = await cosmic.media.find({
      query: { name: filename },
      limit: 1,
      props: "id,original_name,name,url,imgix_url"
    });

    if (response2 && response2.media && response2.media.length > 0) {
      return response2.media[0];
    }

    return null;
  } catch (error) {
    console.error(`   ❌ Error finding media for ${filename}:`, error.message);
    return null;
  }
}

async function fixEpisodeImage(episode) {
  try {
    console.log(`\n🔧 Fixing episode: ${episode.title}`);
    
    const image = episode.metadata?.image;
    if (!image || typeof image !== 'object' || !image.url) {
      console.log(`   ⚠️ Episode missing image URL, skipping`);
      return false;
    }

    // Extract filename from corrupted URL
    const filename = await extractFilenameFromUrl(image.url);
    if (!filename) {
      console.log(`   ❌ Could not extract filename from URL: ${image.url}`);
      return false;
    }

    console.log(`   📁 Extracted filename: ${filename}`);

    // Find the media object in Cosmic
    const mediaItem = await findMediaByFilename(filename);
    if (!mediaItem) {
      console.log(`   ❌ Could not find media object for filename: ${filename}`);
      return false;
    }

    console.log(`   📸 Found media item: ${mediaItem.name}`);

    // Update the episode with the correct image reference
    // Use mediaItem.name as per Cosmic API documentation
    const updateData = {
      metadata: {
        image: mediaItem.name, // Use the media name, not the corrupted URL
      },
    };

    console.log(`   📝 Updating episode with media name: ${mediaItem.name}`);
    
    const result = await cosmic.objects.updateOne(episode.id, updateData);
    
    if (result && result.object) {
      console.log(`   ✅ Successfully updated episode: ${episode.title}`);
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

async function fixAllEpisodeImages() {
  try {
    console.log("🔧 Starting to fix episode image references...");

    const episodesToFix = await findEpisodesWithCorruptedImages();
    
    if (episodesToFix.length === 0) {
      console.log("✅ No episodes found with corrupted image URLs");
      return;
    }

    console.log(`\n🔧 Found ${episodesToFix.length} episodes to fix:`);
    episodesToFix.slice(0, 10).forEach(ep => {
      console.log(`   - ${ep.title}`);
    });
    if (episodesToFix.length > 10) {
      console.log(`   ... and ${episodesToFix.length - 10} more`);
    }

    console.log(`\n⚠️ About to fix ${episodesToFix.length} episodes!`);
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
    
    // Wait 5 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 5000));

    let fixed = 0;
    let failed = 0;

    for (const episode of episodesToFix) {
      const success = await fixEpisodeImage(episode);
      if (success) {
        fixed++;
      } else {
        failed++;
      }
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Fix Summary:`);
    console.log(`   🎯 Total episodes to fix: ${episodesToFix.length}`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Failed: ${failed}`);

  } catch (error) {
    console.error("❌ Error in fix process:", error);
  }
}

async function main() {
  console.log("🔧 Starting episode image reference fix process...");

  try {
    await fixAllEpisodeImages();
    console.log("\n🎉 Fix process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
