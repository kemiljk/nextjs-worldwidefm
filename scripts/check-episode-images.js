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

async function checkEpisodeImages() {
  try {
    console.log("🔍 Checking images for migrated episodes...");

    // Get all episodes that were migrated from Craft
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      props: "id,title,slug,metadata,thumbnail",
    });

    const episodes = response.objects || [];
    console.log(`✅ Found ${episodes.length} migrated episodes`);

    // Group episodes by image to see duplicates
    const imageGroups = new Map();

    episodes.forEach((episode) => {
      const image = episode.metadata?.image;
      const thumbnail = episode.thumbnail;

      if (image) {
        // Use the image URL as the key for uniqueness
        let imageKey;
        if (typeof image === "string") {
          imageKey = image;
        } else if (image && typeof image === "object" && image.url) {
          imageKey = image.url;
        } else {
          imageKey = "unknown";
        }

        if (!imageGroups.has(imageKey)) {
          imageGroups.set(imageKey, []);
        }
        imageGroups.get(imageKey).push({
          title: episode.title,
          slug: episode.slug,
          image: image,
          thumbnail: thumbnail,
        });
      }
    });

    console.log(`\n📊 Image Usage Summary:`);
    console.log(`   🎯 Total episodes: ${episodes.length}`);
    console.log(`   🖼️ Unique images: ${imageGroups.size}`);

    // Show episodes grouped by image
    imageGroups.forEach((episodes, imageKey) => {
      console.log(`\n🖼️ Image: ${imageKey}`);
      console.log(`   📺 Used by ${episodes.length} episodes:`);
      episodes.forEach((ep) => {
        console.log(`      - ${ep.title}`);
      });
    });

    // Check for episodes with the same image
    const duplicateImages = Array.from(imageGroups.entries()).filter(([key, episodes]) => episodes.length > 1);

    if (duplicateImages.length > 0) {
      console.log(`\n⚠️ WARNING: Found ${duplicateImages.length} images used by multiple episodes:`);
      duplicateImages.forEach(([imageKey, episodes]) => {
        console.log(`   🖼️ ${imageKey}: ${episodes.length} episodes`);
      });
    } else {
      console.log(`\n✅ All episodes have unique images`);
    }
  } catch (error) {
    console.error("❌ Error checking episode images:", error.message);
  }
}

async function main() {
  console.log("🔍 Starting episode image check...");

  try {
    await checkEpisodeImages();
    console.log("\n🎉 Episode image check completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, checkEpisodeImages };
