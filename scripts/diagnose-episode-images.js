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

async function diagnoseEpisodeImages() {
  try {
    console.log("🔍 Diagnosing episode image fields...");

    // Get a sample of episodes to examine their structure
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      limit: 10,
      props: "id,title,slug,metadata,thumbnail",
    });

    const episodes = response.objects || [];
    console.log(`✅ Found ${episodes.length} sample episodes`);

    console.log("\n📊 Detailed Image Field Analysis:");
    
    episodes.forEach((episode, index) => {
      console.log(`\n--- Episode ${index + 1}: ${episode.title} ---`);
      console.log(`   Slug: ${episode.slug}`);
      console.log(`   ID: ${episode.id}`);
      
      // Check metadata.image
      const metadataImage = episode.metadata?.image;
      console.log(`   metadata.image: ${JSON.stringify(metadataImage)}`);
      console.log(`   metadata.image type: ${typeof metadataImage}`);
      
      // Check thumbnail
      const thumbnail = episode.thumbnail;
      console.log(`   thumbnail: ${JSON.stringify(thumbnail)}`);
      console.log(`   thumbnail type: ${typeof thumbnail}`);
      
      // Check if image field exists at all
      const hasImageField = 'image' in (episode.metadata || {});
      console.log(`   Has image field: ${hasImageField}`);
      
      // Check all metadata fields
      console.log(`   All metadata fields: ${Object.keys(episode.metadata || {}).join(', ')}`);
    });

    // Check total count
    const countResponse = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      limit: 1,
    });
    
    console.log(`\n📈 Total migrated episodes: ${countResponse.total || 'unknown'}`);

  } catch (error) {
    console.error("❌ Error diagnosing episode images:", error.message);
  }
}

async function main() {
  console.log("🔍 Starting episode image diagnosis...");

  try {
    await diagnoseEpisodeImages();
    console.log("\n🎉 Diagnosis completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, diagnoseEpisodeImages };
