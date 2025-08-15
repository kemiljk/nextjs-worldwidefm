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

async function findEpisodesWithBrokenImageUrls() {
  try {
    console.log("🔍 Finding episodes with broken image URLs...");

    // Get all episodes that were migrated from Craft
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      props: "id,title,slug,metadata,thumbnail",
    });

    const episodes = response.objects || [];
    console.log(`✅ Found ${episodes.length} migrated episodes`);

    // Filter episodes that have broken image URLs (missing filename)
    const episodesWithBrokenUrls = episodes.filter(episode => {
      const image = episode.metadata?.image;
      const thumbnail = episode.thumbnail;
      
      // Check if image URL is broken (missing filename)
      if (image && typeof image === 'object' && image.url) {
        // If the URL doesn't contain a file extension or filename, it's broken
        const url = image.url;
        const hasFilename = url.includes('-') && (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp') || url.includes('.HEIC'));
        
        return !hasFilename;
      }
      
      return false;
    });

    console.log(`🔍 Found ${episodesWithBrokenUrls.length} episodes with broken image URLs`);
    return episodesWithBrokenUrls;
  } catch (error) {
    console.error("❌ Error finding episodes with broken image URLs:", error.message);
    return [];
  }
}

async function fixEpisodeImageUrl(episode) {
  try {
    console.log(`\n🔧 Fixing episode: ${episode.title}`);
    
    const image = episode.metadata?.image;
    const thumbnail = episode.thumbnail;
    
    if (!image || !thumbnail) {
      console.log(`   ⚠️ Episode missing image or thumbnail, skipping`);
      return false;
    }
    
    // Check if image is already correct (has url and imgix_url)
    if (image.url && image.imgix_url) {
      console.log(`   ✅ Episode already has correct image structure`);
      return true;
    }
    
    // Extract filename from thumbnail
    // Thumbnail format: "https://imgix.cosmicjs.com/1028a950-79e4-11f0-a283-b3e51e2ec7be-20250812-New-Voices-Santa-Leticia.HEIC"
    const thumbnailUrl = thumbnail;
    const filename = thumbnailUrl.split('/').pop(); // Get the filename part
    
    if (!filename) {
      console.log(`   ❌ Could not extract filename from thumbnail`);
      return false;
    }
    
    console.log(`   📁 Extracted filename: ${filename}`);
    
    // Find the actual media object in Cosmic using the filename
    // We need to search for media with this filename to get the correct mediaItem.name
    const mediaResponse = await cosmic.media.find({
      query: { original_name: filename },
      limit: 1,
      props: "id,original_name,name,url,imgix_url"
    });
    
    if (!mediaResponse || !mediaResponse.media || mediaResponse.media.length === 0) {
      console.log(`   ❌ Could not find media object with filename: ${filename}`);
      return false;
    }
    
    const mediaItem = mediaResponse.media[0];
    console.log(`   📸 Found media item: ${mediaItem.name}`);
    
    // Update the episode with the correct image structure
    // Use mediaItem.name as per Cosmic API documentation
    const updateData = {
      metadata: {
        image: mediaItem.name, // Use the media name, not the filename
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

async function fixAllEpisodeImageUrls() {
  try {
    console.log("🔧 Starting to fix episode image URLs...");

    const episodesToFix = await findEpisodesWithBrokenImageUrls();
    
    if (episodesToFix.length === 0) {
      console.log("✅ No episodes found with broken image URLs");
      return;
    }

    console.log(`\n🔧 Found ${episodesToFix.length} episodes to fix:`);
    episodesToFix.forEach(ep => {
      console.log(`   - ${ep.title}`);
    });

    console.log(`\n⚠️ About to fix ${episodesToFix.length} episodes!`);
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
    
    // Wait 5 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 5000));

    let fixed = 0;
    let failed = 0;

    for (const episode of episodesToFix) {
      const success = await fixEpisodeImageUrl(episode);
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
  console.log("🔧 Starting episode image URL fix process...");

  try {
    await fixAllEpisodeImageUrls();
    console.log("\n🎉 Fix process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, fixAllEpisodeImageUrls };
