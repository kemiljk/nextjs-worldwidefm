const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");
const axios = require("axios");

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

// Download image from URL
async function downloadImage(url) {
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "arraybuffer",
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    return null;
  }
}

// Upload image to Cosmic media
async function uploadImageToCosmic(imageBuffer, filename) {
  try {
    const media = await cosmic.media.insertOne({
      media: {
        originalname: filename,
        buffer: imageBuffer,
      },
      folder: "host-placeholders",
    });

    return media.media;
  } catch (error) {
    console.error(`Error uploading ${filename} to Cosmic:`, error.message);
    return null;
  }
}

// Get existing media to avoid duplicates
async function getExistingMedia() {
  try {
    const mediaMap = new Map();
    let skip = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const response = await cosmic.media.find({
        skip,
        limit,
        props: "id,original_name,name,url,imgix_url",
      });

      if (!response || !response.media) {
        break;
      }

      const mediaItems = response.media;

      mediaItems.forEach((item) => {
        if (item.original_name) {
          mediaMap.set(item.original_name.toLowerCase(), item);
        }
      });

      if (mediaItems.length < limit) {
        hasMore = false;
      } else {
        skip += limit;
      }
    }

    return mediaMap;
  } catch (error) {
    console.error("Error fetching existing media:", error.message);
    return new Map();
  }
}

async function addPlaceholderImages() {
  const isDryRun = process.argv.includes("--dry-run");
  const isTest = process.argv.includes("--test");

  console.log("🖼️  Adding Proper Placeholder Images to Hosts");
  console.log("==============================================");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : isTest ? "TEST (3 hosts)" : "LIVE"}`);
  console.log("");

  try {
    // Get existing media to avoid duplicates
    console.log("📋 Fetching existing media...");
    const existingMedia = await getExistingMedia();
    console.log(`   Found ${existingMedia.size} existing media items`);

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

    console.log(`   ${hostsWithoutImages.length} hosts to process\n`);

    if (hostsWithoutImages.length === 0) {
      console.log("🎉 All hosts already have images!");
      return;
    }

    // Process hosts
    let updatedCount = 0;
    let errorCount = 0;
    let uploadedCount = 0;

    for (let i = 0; i < hostsWithoutImages.length; i++) {
      const host = hostsWithoutImages[i];
      const imageUrl = placeholderImages[i % placeholderImages.length];
      const filename = `host-placeholder-${i + 1}.jpg`;

      console.log(`🔄 Processing: ${host.title} (${host.slug})`);
      console.log(`   Image: ${imageUrl}`);

      if (isDryRun) {
        console.log(`   🔍 Would download and upload image, then link to host`);
        updatedCount++;
        continue;
      }

      try {
        let mediaItem = null;

        // Check if we already have this image
        if (existingMedia.has(filename.toLowerCase())) {
          mediaItem = existingMedia.get(filename.toLowerCase());
          console.log(`   ✅ Using existing media: ${mediaItem.name}`);
        } else {
          // Download the image
          console.log(`   📥 Downloading image...`);
          const imageBuffer = await downloadImage(imageUrl);
          if (!imageBuffer) {
            errorCount++;
            continue;
          }

          // Upload to Cosmic
          console.log(`   📤 Uploading to Cosmic...`);
          mediaItem = await uploadImageToCosmic(imageBuffer, filename);
          if (!mediaItem) {
            errorCount++;
            continue;
          }
          uploadedCount++;
          console.log(`   ✅ Uploaded: ${mediaItem.name}`);
        }

        // Update host with media reference
        console.log(`   🔗 Linking to host...`);
        const updateData = {
          metadata: {
            ...host.metadata,
            image: mediaItem.name, // Use the media name as reference
          },
        };

        await cosmic.objects.updateOne(host.id, updateData);
        console.log(`   ✅ Host updated successfully`);
        updatedCount++;
      } catch (error) {
        console.error(`   ❌ Error processing host: ${error.message}`);
        errorCount++;
      }

      // Add a small delay to avoid rate limiting
      if (!isDryRun && i % 5 === 0) {
        console.log("   ⏳ Pausing to avoid rate limits...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log(`   📤 Images uploaded: ${uploadedCount}`);
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
