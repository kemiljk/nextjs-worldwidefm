require("dotenv").config({ path: ".env.local" });
const { createBucketClient } = require("@cosmicjs/sdk");

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

async function fixBrokenGenreRelationships() {
  try {
    console.log("🔧 Fixing broken genre relationships...");
    
    // Get episodes that have broken genre relationships (empty objects or arrays with empty objects)
    const response = await cosmic.objects.find({
      type: "episode",
      props: "id,slug,title,metadata.genres",
      limit: 100,
      depth: 2,
      status: "published",
      "metadata.broadcast_date": {
        $gte: "2025-07-24T11:00:00+00:00",
      },
    });

    if (!response.objects || response.objects.length === 0) {
      console.log("❌ No episodes found");
      return;
    }

    console.log(`📄 Found ${response.objects.length} episodes to check...\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const episode of response.objects) {
      const genres = episode.metadata?.genres;
      
      if (!genres || !Array.isArray(genres)) {
        console.log(`⏭️ Skipping ${episode.title} - no genres field`);
        skippedCount++;
        continue;
      }

      // Check if genres array contains empty objects or broken references
      const hasBrokenGenres = genres.some(genre => 
        !genre || typeof genre !== 'object' || Object.keys(genre).length === 0
      );

      if (!hasBrokenGenres) {
        console.log(`✅ ${episode.title} - genres look good`);
        skippedCount++;
        continue;
      }

      console.log(`🔧 Fixing ${episode.title} - has broken genres:`, genres);

      // Clear out the broken genres
      try {
        const result = await cosmic.objects.updateOne(episode.id, {
          metadata: {
            genres: []
          }
        });

        if (result && result.object) {
          console.log(`   ✅ Successfully cleared broken genres`);
          fixedCount++;
        } else {
          console.log(`   ❌ Failed to clear genres`);
        }
      } catch (error) {
        console.log(`   ❌ Error clearing genres:`, error.message);
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Fix Summary:`);
    console.log(`   🔧 Episodes fixed: ${fixedCount}`);
    console.log(`   ⏭️ Episodes skipped: ${skippedCount}`);
    console.log(`   🎯 Total processed: ${response.objects.length}`);

    if (fixedCount > 0) {
      console.log(`\n🎉 Now run the update script to re-establish proper genre relationships!`);
      console.log(`   node scripts/update-existing-episode-genres.js --apply`);
    }

  } catch (error) {
    console.error("❌ Error fixing broken relationships:", error);
  }
}

if (require.main === module) {
  fixBrokenGenreRelationships().catch(console.error);
}

module.exports = { fixBrokenGenreRelationships };
