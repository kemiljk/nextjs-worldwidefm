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

interface EpisodeObject {
  id: string;
  slug: string;
  title: string;
  type: string;
  metadata: {
    tracklist_old?: string;
    tracklist?: string;
    [key: string]: any;
  };
  created_at: string;
  modified_at: string;
  published_at: string;
  status: string;
}

async function cleanupTracklistOld() {
  try {
    console.log("🧹 Starting tracklist_old cleanup...");

    let allEpisodes: EpisodeObject[] = [];
    let page = 1;
    const limit = 100; // Cosmic API limit per page

    // Fetch all episodes with pagination
    while (true) {
      console.log(`📄 Fetching page ${page}...`);
      
      const response = await cosmic.objects.find({
        type: "episode",
        props: "id,slug,title,type,metadata.tracklist_old,metadata.tracklist,created_at,modified_at,published_at,status",
        limit: limit,
        skip: (page - 1) * limit,
      });

      if (!response.objects || response.objects.length === 0) {
        console.log(`📄 No more episodes found on page ${page}`);
        break;
      }

      const episodes = response.objects as EpisodeObject[];
      allEpisodes = allEpisodes.concat(episodes);
      console.log(`📄 Page ${page}: Found ${episodes.length} episodes (Total so far: ${allEpisodes.length})`);

      // If we got fewer episodes than the limit, we've reached the end
      if (episodes.length < limit) {
        break;
      }

      page++;
      
      // Add a small delay between page requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (allEpisodes.length === 0) {
      console.log("❌ No episodes found");
      return;
    }

    console.log(`📊 Found ${allEpisodes.length} total episodes to process`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const episode of allEpisodes) {
      try {
        console.log(`\n🔄 Processing: ${episode.title} (${episode.slug})`);

        // Check if tracklist_old exists
        const tracklistOld = episode.metadata?.tracklist_old;

        if (!tracklistOld) {
          console.log(`   ⏭️  Skipping - no tracklist_old field to clean`);
          skipCount++;
          continue;
        }

        // Check if tracklist has content (safety check)
        const currentTracklist = episode.metadata?.tracklist;
        if (!currentTracklist || currentTracklist.trim() === "") {
          console.log(`   ⚠️  Warning - tracklist is empty, skipping cleanup for safety`);
          errorCount++;
          continue;
        }

        console.log(`   🗑️  Removing tracklist_old field...`);

        // Create a new metadata object without tracklist_old
        const { tracklist_old, ...cleanMetadata } = episode.metadata;

        // Update the episode to remove tracklist_old
        const updateResponse = await cosmic.objects.updateOne({
          id: episode.id,
          type: "episodes",
          metadata: cleanMetadata,
        });

        if (updateResponse.object) {
          console.log(`   ✅ Successfully cleaned up episode`);
          successCount++;
        } else {
          console.log(`   ❌ Failed to clean up episode`);
          errorCount++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   💥 Error processing episode ${episode.slug}:`, error);
        errorCount++;
      }
    }

    console.log(`\n🎉 Cleanup completed!`);
    console.log(`📊 Summary:`);
    console.log(`   ✅ Successfully cleaned: ${successCount}`);
    console.log(`   ⏭️  Skipped (no field): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${allEpisodes.length}`);

    if (errorCount === 0) {
      console.log(`\n🎯 All episodes cleaned successfully!`);
      console.log(`💡 The tracklist_old fields have been removed from all episodes.`);
    } else {
      console.log(`\n⚠️  Some episodes had errors. Please review the logs above.`);
    }
  } catch (error) {
    console.error("💥 Fatal error during cleanup:", error);
    process.exit(1);
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupTracklistOld()
    .then(() => {
      console.log("🏁 Cleanup script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Cleanup script failed:", error);
      process.exit(1);
    });
}

export { cleanupTracklistOld };
