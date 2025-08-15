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

async function analyzeEpisodeImageStructure() {
  try {
    console.log("🔍 Analyzing episode image structure...");

    // Get a sample of episodes to examine their structure
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      limit: 20,
      props: "id,title,slug,metadata,thumbnail",
    });

    const episodes = response.objects || [];
    console.log(`✅ Found ${episodes.length} sample episodes`);

    console.log("\n📊 Image Structure Analysis:");

    // Track different image patterns
    const imagePatterns = {
      object_with_url: 0,
      object_without_url: 0,
      string_id: 0,
      string_url: 0,
      null_or_undefined: 0,
      other: 0,
    };

    episodes.forEach((episode, index) => {
      console.log(`\n--- Episode ${index + 1}: ${episode.title} ---`);
      console.log(`   Slug: ${episode.slug}`);
      console.log(`   ID: ${episode.id}`);

      // Check metadata.image
      const metadataImage = episode.metadata?.image;
      console.log(`   metadata.image: ${JSON.stringify(metadataImage)}`);
      console.log(`   metadata.image type: ${typeof metadataImage}`);

      // Categorize the image pattern
      if (metadataImage === null || metadataImage === undefined) {
        imagePatterns.null_or_undefined++;
        console.log(`   📊 Pattern: null_or_undefined`);
      } else if (typeof metadataImage === "string") {
        if (/^[a-f0-9]{24}$/i.test(metadataImage)) {
          imagePatterns.string_id++;
          console.log(`   📊 Pattern: string_id (24-char hex)`);
        } else if (metadataImage.startsWith("http")) {
          imagePatterns.string_url++;
          console.log(`   📊 Pattern: string_url (HTTP URL)`);
        } else {
          imagePatterns.other++;
          console.log(`   📊 Pattern: other string`);
        }
      } else if (typeof metadataImage === "object") {
        if (metadataImage.url) {
          imagePatterns.object_with_url++;
          console.log(`   📊 Pattern: object_with_url`);
        } else {
          imagePatterns.object_without_url++;
          console.log(`   📊 Pattern: object_without_url`);
          console.log(`   📊 Object keys: ${Object.keys(metadataImage).join(", ")}`);
        }
      } else {
        imagePatterns.other++;
        console.log(`   📊 Pattern: other type`);
      }

      // Check thumbnail
      const thumbnail = episode.thumbnail;
      console.log(`   thumbnail: ${JSON.stringify(thumbnail)}`);
      console.log(`   thumbnail type: ${typeof thumbnail}`);

      // Check all metadata fields
      console.log(`   All metadata fields: ${Object.keys(episode.metadata || {}).join(", ")}`);
    });

    console.log(`\n📈 Image Pattern Summary:`);
    Object.entries(imagePatterns).forEach(([pattern, count]) => {
      console.log(`   ${pattern}: ${count} episodes`);
    });

    // Check total count
    const countResponse = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      limit: 1,
    });

    console.log(`\n📊 Total migrated episodes: ${countResponse.total || "unknown"}`);
  } catch (error) {
    console.error("❌ Error analyzing episode image structure:", error.message);
  }
}

async function main() {
  console.log("🔍 Starting episode image structure analysis...");

  try {
    await analyzeEpisodeImageStructure();
    console.log("\n🎉 Analysis completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, analyzeEpisodeImageStructure };
