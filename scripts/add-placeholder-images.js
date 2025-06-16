const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");

// Configuration
const config = {
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
};

// Function to get all hosts from Cosmic
async function getCosmicHosts(cosmic) {
  try {
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
      })
      .props("id,slug,title,metadata")
      .limit(10); // Just get first 10 for testing

    return response.objects || [];
  } catch (error) {
    console.error("❌ Error fetching hosts:", error);
    return [];
  }
}

// Function to update host with placeholder image
async function updateHostWithPlaceholder(cosmic, hostId, hostTitle) {
  try {
    await cosmic.objects.updateOne(hostId, {
      metadata: {
        image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop&crop=face",
      },
    });
    return true;
  } catch (error) {
    console.error(`❌ Error updating host ${hostId}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log("🎯 Adding Placeholder Images to Test Hosts");
  console.log("==========================================");

  // Initialize Cosmic client
  const cosmic = createBucketClient(config.cosmic);

  try {
    // Get first 10 hosts
    console.log("📋 Getting first 10 hosts from Cosmic...");
    const hosts = await getCosmicHosts(cosmic);
    console.log(`   Found ${hosts.length} hosts`);

    let updatedCount = 0;

    for (const host of hosts.slice(0, 5)) {
      // Just update first 5
      console.log(`\n🔄 Processing: ${host.title} (${host.slug})`);

      const success = await updateHostWithPlaceholder(cosmic, host.id, host.title);
      if (success) {
        console.log(`   ✅ Added placeholder image`);
        updatedCount++;
      }
    }

    console.log(`\n📊 Summary: Updated ${updatedCount} hosts with placeholder images`);
    console.log("\n🎉 You can now test the host pages at:");
    console.log("   http://localhost:3000/hosts/pedro-montenegro");
    console.log("   http://localhost:3000/hosts/ashley-beedle");
    console.log("   (or any other host slug)");
  } catch (error) {
    console.error("❌ Script error:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
