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

async function testImageUpdate() {
  try {
    console.log("🧪 Testing image update for a single episode...");

    // Get one episode to test with
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      limit: 1,
      props: "id,title,slug,metadata,thumbnail",
    });

    if (!response || !response.objects || response.objects.length === 0) {
      console.error("No episodes found");
      return;
    }

    const episode = response.objects[0];
    console.log(`\n📋 Testing with episode: ${episode.title}`);
    console.log(`Current metadata.image:`, JSON.stringify(episode.metadata?.image, null, 2));

    // Extract filename from the current URL
    const currentUrl = episode.metadata?.image?.url;
    if (!currentUrl) {
      console.log("❌ Episode has no image URL");
      return;
    }

    console.log(`🔗 Full URL: ${currentUrl}`);

    // Extract filename (everything after the last forward slash)
    // URL format: "https://cdn.cosmicjs.com/79e4-11f0-a283-b3e51e2ec7be-20250812-New-Voices-Santa-Leticia.HEIC"
    // We need: "79e4-11f0-a283-b3e51e2ec7be-20250812-New-Voices-Santa-Leticia.HEIC"

    const lastSlashIndex = currentUrl.lastIndexOf("/");
    console.log(`📍 Last slash index: ${lastSlashIndex}`);
    console.log(`📍 Character at last slash: "${currentUrl[lastSlashIndex]}"`);
    console.log(`📍 Everything after last slash: "${currentUrl.substring(lastSlashIndex + 1)}"`);

    if (lastSlashIndex === -1) {
      console.log("❌ No slash found in URL");
      return;
    }

    const filename = currentUrl.substring(lastSlashIndex + 1);
    console.log(`📁 Extracted filename: ${filename}`);

    // Find the media object in Cosmic
    const mediaResponse = await cosmic.media.find({
      query: { original_name: filename },
      limit: 1,
      props: "id,original_name,name,url,imgix_url",
    });

    if (!mediaResponse || !mediaResponse.media || mediaResponse.media.length === 0) {
      console.log(`❌ Could not find media object for filename: ${filename}`);

      // Let's see what media objects exist
      console.log(`\n🔍 Checking what media objects exist in Cosmic...`);
      const allMediaResponse = await cosmic.media.find({
        limit: 5,
        props: "id,original_name,name",
      });

      if (allMediaResponse && allMediaResponse.media) {
        console.log(`📋 Found ${allMediaResponse.media.length} media objects:`);
        allMediaResponse.media.forEach((media, index) => {
          console.log(`   ${index + 1}. original_name: "${media.original_name}", name: "${media.name}"`);
        });
      }

      return;
    }

    const mediaItem = mediaResponse.media[0];
    console.log(`📸 Found media item: ${mediaItem.name}`);

    // Test updating with just the filename
    console.log(`\n🧪 Testing update with metadata.image = "${mediaItem.name}"`);

    const updateData = {
      metadata: {
        image: mediaItem.name,
      },
    };

    console.log(`Update data:`, JSON.stringify(updateData, null, 2));

    // Try the update
    const result = await cosmic.objects.updateOne(episode.id, updateData);

    if (result && result.object) {
      console.log(`✅ Successfully updated episode!`);
      console.log(`New metadata.image:`, JSON.stringify(result.object.metadata?.image, null, 2));
    } else {
      console.log(`❌ Failed to update episode`);
    }
  } catch (error) {
    console.error("❌ Error in test:", error.message);
  }
}

async function main() {
  console.log("🧪 Starting image update test...");

  try {
    await testImageUpdate();
    console.log("\n🎉 Test completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
