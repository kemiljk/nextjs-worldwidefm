import { createBucketClient } from "@cosmicjs/sdk";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Initialize Cosmic client with loaded environment variables
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
});

async function checkRandomEpisodes() {
  try {
    console.log("🔍 Checking random episodes to verify migration status...");

    // Get total count first
    const totalResponse = await cosmic.objects.find({
      type: "episode",
      props: "id",
      limit: 1,
    });

    const totalEpisodes = totalResponse.total || 0;
    console.log(`📊 Total episodes in Cosmic: ${totalEpisodes}\n`);

    // Check episodes from start, middle, and end
    const positions = [
      { name: "START", skip: 0 },
      { name: "MIDDLE", skip: Math.floor(totalEpisodes / 2) },
      { name: "END", skip: totalEpisodes - 10 },
    ];

    for (const position of positions) {
      console.log(`📍 Checking ${position.name} episodes (skip: ${position.skip}):`);
      console.log("─".repeat(50));

      const response = await cosmic.objects.find({
        type: "episode",
        props: "id,slug,title,metadata.tracklist,metadata.tracklist_old",
        limit: 3,
        skip: position.skip,
      });

      if (response.objects && response.objects.length > 0) {
        for (const episode of response.objects) {
          const tracklist = episode.metadata?.tracklist || null;
          const tracklistOld = episode.metadata?.tracklist_old || null;

          console.log(`\n🎵 ${episode.title}`);
          console.log(`   Slug: ${episode.slug}`);
          console.log(`   Tracklist: ${tracklist ? `✅ Has content (${tracklist.length} chars)` : "❌ Empty/null"}`);
          console.log(`   Tracklist Old: ${tracklistOld ? `⚠️  Has old data (${tracklistOld.length} chars)` : "✅ Clean (no old data)"}`);

          // Show first 100 chars of tracklist if it exists
          if (tracklist && tracklist.length > 0) {
            const preview = tracklist.length > 100 ? tracklist.substring(0, 100) + "..." : tracklist;
            console.log(`   Preview: "${preview}"`);
          }
        }
      } else {
        console.log("   No episodes found at this position");
      }

      console.log("\n");

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("🎯 Migration Status Summary:");
    console.log("   If you see '✅ Has content' for tracklist and '✅ Clean' for tracklist_old,");
    console.log("   then the migration was successful!");
  } catch (error) {
    console.error("💥 Error checking episodes:", error);
  }
}

// Run the check
checkRandomEpisodes()
  .then(() => {
    console.log("🏁 Check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Check failed:", error);
    process.exit(1);
  });
