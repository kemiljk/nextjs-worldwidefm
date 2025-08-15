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

async function checkEpisodeCount() {
  try {
    console.log("🔍 Checking total episode count in Cosmic...");
    
    // First, let's try to get the total count from a single request
    const response = await cosmic.objects.find({
      type: "episode",
      props: "id",
      limit: 1,
    });

    console.log("📊 Response:", {
      total: response.total,
      objects: response.objects?.length || 0,
      hasMore: response.objects && response.objects.length > 0
    });

    // Now let's check with a larger limit to see what we get
    const largeResponse = await cosmic.objects.find({
      type: "episode",
      props: "id",
      limit: 1000,
    });

    console.log("📊 Large response:", {
      total: largeResponse.total,
      objects: largeResponse.objects?.length || 0,
      hasMore: largeResponse.objects && largeResponse.objects.length === 1000
    });

    // Let's also check what happens with a very high skip value
    const highSkipResponse = await cosmic.objects.find({
      type: "episode",
      props: "id",
      limit: 100,
      skip: 100000, // Try to skip 100k episodes
    });

    console.log("📊 High skip response:", {
      total: highSkipResponse.total,
      objects: highSkipResponse.objects?.length || 0,
      hasMore: highSkipResponse.objects && highSkipResponse.objects.length > 0
    });

    console.log("\n🎯 Summary:");
    if (response.total) {
      console.log(`   Total episodes according to Cosmic: ${response.total}`);
    } else {
      console.log("   No total count available from Cosmic");
    }
    
    console.log("   This should match what you see in the Cosmic UI");

  } catch (error) {
    console.error("💥 Error checking episode count:", error);
  }
}

// Run the check
checkEpisodeCount()
  .then(() => {
    console.log("🏁 Check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Check failed:", error);
    process.exit(1);
  });
