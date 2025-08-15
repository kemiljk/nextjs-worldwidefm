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

async function getBrokenEpisodes() {
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

    // Filter episodes that have broken image references
    const brokenEpisodes = episodes.filter((episode) => {
      const image = episode.metadata?.image;
      // Check if image is missing, null, or "unknown"
      return !image || image === "unknown" || image === null;
    });

    console.log(`🔍 Found ${brokenEpisodes.length} episodes with broken image references`);
    return brokenEpisodes;
  } catch (error) {
    console.error("❌ Error finding broken episodes:", error.message);
    return [];
  }
}

async function deleteEpisode(episode) {
  try {
    console.log(`🗑️ Deleting episode: ${episode.title}`);

    const result = await cosmic.objects.deleteOne(episode.id);

    if (result) {
      console.log(`   ✅ Successfully deleted: ${episode.title}`);
      return true;
    } else {
      console.log(`   ❌ Failed to delete: ${episode.title}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error deleting episode ${episode.title}:`, error.message);
    return false;
  }
}

async function cleanupBrokenEpisodes() {
  try {
    console.log("🧹 Starting cleanup of broken episodes...");

    const brokenEpisodes = await getBrokenEpisodes();

    if (brokenEpisodes.length === 0) {
      console.log("✅ No broken episodes found to clean up");
      return;
    }

    console.log(`\n⚠️ WARNING: About to delete ${brokenEpisodes.length} episodes!`);
    console.log("This action cannot be undone.");
    console.log("Press Ctrl+C to cancel, or wait 10 seconds to continue...");

    // Wait 10 seconds to allow cancellation
    await new Promise((resolve) => setTimeout(resolve, 10000));

    let deleted = 0;
    let failed = 0;

    for (const episode of brokenEpisodes) {
      const success = await deleteEpisode(episode);
      if (success) {
        deleted++;
      } else {
        failed++;
      }

      // Add a small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   🎯 Total broken episodes: ${brokenEpisodes.length}`);
    console.log(`   ✅ Deleted: ${deleted}`);
    console.log(`   ❌ Failed: ${failed}`);
  } catch (error) {
    console.error("❌ Error in cleanup process:", error);
  }
}

async function main() {
  console.log("🧹 Starting broken episode cleanup process...");

  try {
    await cleanupBrokenEpisodes();
    console.log("\n🎉 Cleanup process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, cleanupBrokenEpisodes };
