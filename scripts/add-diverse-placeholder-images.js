const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

// Diverse placeholder images from Unsplash
const placeholderImages = [
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop&crop=face", // Person 1
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face", // Person 2
  "https://images.unsplash.com/photo-1494790108755-2616c0763c5c?w=400&h=400&fit=crop&crop=face", // Person 3
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face", // Person 4
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face", // Person 5
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face", // Person 6
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face", // Person 7
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face", // Person 8
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face", // Person 9
  "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop&crop=face", // Person 10
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face", // Person 11
  "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=400&h=400&fit=crop&crop=face", // Person 12
  "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=400&h=400&fit=crop&crop=face", // Person 13
  "https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=400&fit=crop&crop=face", // Person 14
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face", // Person 15
];

async function addPlaceholderImages() {
  const isDryRun = process.argv.includes("--dry-run");
  const isTest = process.argv.includes("--test");

  console.log("🖼️  Adding Diverse Placeholder Images to Hosts");
  console.log("==============================================");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : isTest ? "TEST (3 hosts)" : "LIVE"}`);
  console.log("");

  try {
    // Get all hosts
    console.log("📋 Fetching all hosts...");
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
      })
      .props("id,slug,title,metadata")
      .limit(1000);

    const allHosts = response.objects || [];
    console.log(`   Found ${allHosts.length} total hosts`);

    // Filter hosts without images
    let hostsWithoutImages = allHosts.filter((host) => !host.metadata?.image || host.metadata.image === "");

    // If test mode, only process first 3
    if (isTest) {
      hostsWithoutImages = hostsWithoutImages.slice(0, 3);
    }

    console.log(`   ${hostsWithoutImages.length} hosts to process`);
    console.log(`   ${allHosts.length - (allHosts.length - hostsWithoutImages.length)} hosts already have images\n`);

    if (hostsWithoutImages.length === 0) {
      console.log("🎉 All hosts already have images!");
      return;
    }

    // Process hosts
    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < hostsWithoutImages.length; i++) {
      const host = hostsWithoutImages[i];
      const imageUrl = placeholderImages[i % placeholderImages.length];

      console.log(`🔄 Processing: ${host.title} (${host.slug})`);
      console.log(`   Image: ${imageUrl}`);

      if (isDryRun) {
        console.log(`   🔍 Would update host with placeholder image`);
        updatedCount++;
        continue;
      }

      try {
        // Use the same format as the working hosts
        const imageObject = {
          url: `https://cdn.cosmicjs.com/${imageUrl}`,
          imgix_url: `https://cdn.cosmicjs.com/${imageUrl}`,
        };

        // Only update the image field, preserve existing metadata
        const updateData = {
          metadata: {
            ...host.metadata,
            image: imageObject,
          },
        };

        await cosmic.objects.updateOne(host.id, updateData);

        console.log(`   ✅ Updated successfully`);
        updatedCount++;
      } catch (error) {
        console.error(`   ❌ Error updating host: ${error.message}`);
        errorCount++;
      }

      // Add a small delay to avoid rate limiting
      if (!isDryRun && i % 10 === 0) {
        console.log("   ⏳ Pausing to avoid rate limits...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log(`   ✅ Hosts updated: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total processed: ${hostsWithoutImages.length}`);

    if (isDryRun) {
      console.log("\n🔍 This was a dry run. Use --test to test with 3 hosts, or remove flags for full run.");
    } else if (isTest) {
      console.log("\n🧪 This was a test run. Remove --test to process all hosts.");
    } else {
      console.log("\n🎉 Placeholder images added successfully!");
      console.log("\n💡 Next steps:");
      console.log("   1. Visit your Cosmic CMS dashboard");
      console.log("   2. Upload actual host photos to the Media section");
      console.log("   3. Edit each host to replace placeholder with real image");
    }
  } catch (error) {
    console.error("❌ Script error:", error);
    process.exit(1);
  }
}

addPlaceholderImages();
