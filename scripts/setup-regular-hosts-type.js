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

// Validate Cosmic configuration
if (!config.cosmic.bucketSlug || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration:");
  if (!config.cosmic.bucketSlug) console.error("- NEXT_PUBLIC_COSMIC_BUCKET_SLUG is not set");
  if (!config.cosmic.writeKey) console.error("- COSMIC_WRITE_KEY is not set");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function setupRegularHostsType() {
  console.log("🔧 Setting up regular-hosts object type in Cosmic...");

  try {
    // Define the object type with metafields
    const objectTypeData = {
      slug: "regular-hosts",
      title: "Regular Hosts",
      singular: "Regular Host",
      metafields: [
        {
          type: "textarea",
          title: "Description",
          key: "description",
          required: false,
          children: null,
        },
        {
          type: "file",
          title: "Profile Image",
          key: "image",
          required: false,
          children: null,
        },
      ],
    };

    console.log("📋 Creating object type with metafields:");
    objectTypeData.metafields.forEach((field) => {
      console.log(`   - ${field.title} (${field.key}): ${field.type}`);
    });

    // Create or update the object type
    const result = await cosmic.objectTypes.insertOne(objectTypeData);

    console.log(`✅ Successfully created/updated object type: ${result.object_type.title}`);
    console.log(`🆔 Object type ID: ${result.object_type.id}`);
    console.log(`🔗 Slug: ${result.object_type.slug}`);

    return result.object_type;
  } catch (error) {
    console.error("❌ Error setting up object type:", error);

    // If it already exists, that's probably fine
    if (error.message && error.message.includes("already exists")) {
      console.log("ℹ️ Object type already exists, which is fine!");
      return true;
    }

    throw error;
  }
}

async function main() {
  console.log("🎵 Setting up Cosmic object type for regular hosts...");

  try {
    await setupRegularHostsType();

    console.log("\n🎉 Object type setup completed!");
    console.log("\n💡 Next steps:");
    console.log("   1. Preview host data: node scripts/preview-host-data.js");
    console.log("   2. Create hosts (dry run): node scripts/create-host-profiles.js --dry-run");
    console.log("   3. Create hosts (live): node scripts/create-host-profiles.js --live");
  } catch (error) {
    console.error("❌ Error in setup process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupRegularHostsType };
