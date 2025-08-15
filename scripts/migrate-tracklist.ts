import { createBucketClient } from "@cosmicjs/sdk";
import dotenv from "dotenv";
import { sanitizeTracklist } from "../lib/sanitize-html";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Initialize Cosmic client with loaded environment variables
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
});

// Debug: Check environment variables
console.log("🔍 Environment check:");
console.log("  Bucket slug:", process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG ? "✅ Set" : "❌ Missing");
console.log("  Read key:", process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? "✅ Set" : "❌ Missing");
console.log("  Write key:", process.env.COSMIC_WRITE_KEY ? "✅ Set" : "❌ Missing");

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

async function migrateTracklist(startPage: number = 1) {
  try {
    console.log(`🚀 Starting tracklist migration from page ${startPage}...`);

    let page = startPage;
    const limit = 100; // Cosmic API limit per page
    let totalProcessed = 0;
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Get total count first
    const totalResponse = await cosmic.objects.find({
      type: "episode",
      props: "id",
      limit: 1,
    });

    const totalEpisodes = totalResponse.total || 0;
    console.log(`📊 Total episodes in Cosmic: ${totalEpisodes}`);

    // Process episodes as we fetch them to avoid timeouts
    while (totalProcessed < totalEpisodes) {
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
      console.log(`📄 Page ${page}: Processing ${episodes.length} episodes (Total processed so far: ${totalProcessed}/${totalEpisodes})`);

      // Process episodes on this page immediately
      for (const episode of episodes) {
        try {
          console.log(`\n🔄 Processing: ${episode.title} (${episode.slug})`);

          // Check if tracklist_old exists and has content
          const tracklistOld = episode.metadata?.tracklist_old;

          if (!tracklistOld) {
            console.log(`   ⏭️  Skipping - no tracklist_old data`);
            skipCount++;
            totalProcessed++;
            continue;
          }

          // Check if tracklist already has content
          const currentTracklist = episode.metadata?.tracklist;
          if (currentTracklist && currentTracklist.trim() !== "") {
            console.log(`   ⏭️  Skipping - tracklist already has content`);
            skipCount++;
            totalProcessed++;
            continue;
          }

          console.log(`   📝 Moving tracklist_old to tracklist...`);
          console.log(`   📄 Content length: ${tracklistOld.length} characters`);

          // Sanitize the tracklist content before storing
          const sanitizedTracklist = sanitizeTracklist(tracklistOld);
          console.log(`   🧹 Sanitized content length: ${sanitizedTracklist.length} characters`);

          // Update the episode with the sanitized tracklist data
          const updateResponse = await cosmic.objects.updateOne(episode.id, {
            metadata: {
              tracklist: sanitizedTracklist,
            },
          });

          if (updateResponse.object) {
            console.log(`   ✅ Successfully updated episode`);
            successCount++;
          } else {
            console.log(`   ❌ Failed to update episode`);
            errorCount++;
          }

          totalProcessed++;

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   💥 Error processing episode ${episode.slug}:`, error);
          errorCount++;
          totalProcessed++;
        }
      }

            // Move to next page
      page++;
      
      // Add a small delay between page requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Summary:`);
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ⏭️  Skipped (no data): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${totalProcessed}`);

    if (errorCount === 0) {
      console.log(`\n🎯 All episodes processed successfully!`);
      console.log(`💡 You can now verify the migration in Cosmic CMS and then run a cleanup script to remove tracklist_old fields if desired.`);
    } else {
      console.log(`\n⚠️  Some episodes had errors. Please review the logs above.`);
    }
  } catch (error) {
    console.error("💥 Fatal error during migration:", error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  // Check if a start page was provided as a command line argument
  const startPage = process.argv[2] ? parseInt(process.argv[2]) : 1;

  if (isNaN(startPage) || startPage < 1) {
    console.error("❌ Invalid start page. Please provide a valid page number (e.g., node script.js 983)");
    process.exit(1);
  }

  migrateTracklist(startPage)
    .then(() => {
      console.log("🏁 Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateTracklist };
