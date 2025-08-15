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

async function debugEpisodeStructure() {
  try {
    console.log("🔍 Debugging episode structure...");

    // Get a few episodes that we think have broken image URLs
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      limit: 5,
      props: "id,title,slug,metadata,thumbnail"
    });

    if (!response || !response.objects) {
      console.error("No episodes found");
      return;
    }

    console.log(`\n📋 Found ${response.objects.length} episodes to examine:`);

    response.objects.forEach((episode, index) => {
      console.log(`\n--- Episode ${index + 1}: ${episode.title} ---`);
      console.log(`ID: ${episode.id}`);
      console.log(`Slug: ${episode.slug}`);
      
      if (episode.metadata) {
        console.log(`Metadata keys: ${Object.keys(episode.metadata).join(', ')}`);
        
        if (episode.metadata.image) {
          console.log(`Metadata.image type: ${typeof episode.metadata.image}`);
          console.log(`Metadata.image value:`, JSON.stringify(episode.metadata.image, null, 2));
        } else {
          console.log(`Metadata.image: MISSING`);
        }
      } else {
        console.log(`Metadata: MISSING`);
      }
      
      if (episode.thumbnail) {
        console.log(`Thumbnail type: ${typeof episode.thumbnail}`);
        console.log(`Thumbnail value: ${episode.thumbnail}`);
      } else {
        console.log(`Thumbnail: MISSING`);
      }
    });

  } catch (error) {
    console.error("❌ Error debugging episodes:", error.message);
  }
}

async function main() {
  console.log("🔍 Starting episode structure debug...");

  try {
    await debugEpisodeStructure();
    console.log("\n🎉 Debug completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
