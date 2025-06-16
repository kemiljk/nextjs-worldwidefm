const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

async function checkFieldConfig() {
  try {
    console.log("🔍 Checking Object Type Configuration");
    console.log("====================================");

    // Get object types
    const objectTypes = await cosmic.objectTypes.find();

    const regularHostsType = objectTypes.object_types.find((type) => type.slug === "regular-hosts");

    if (!regularHostsType) {
      console.log("❌ regular-hosts object type not found");
      return;
    }

    console.log(`✅ Found object type: ${regularHostsType.title}`);
    console.log(`   Slug: ${regularHostsType.slug}`);
    console.log(`   ID: ${regularHostsType.id}`);

    if (regularHostsType.metafields && regularHostsType.metafields.length > 0) {
      console.log("\n📋 Metafields:");
      regularHostsType.metafields.forEach((field) => {
        console.log(`   • ${field.title} (${field.key})`);
        console.log(`     Type: ${field.type}`);
        console.log(`     Required: ${field.required || false}`);
        if (field.children && field.children.length > 0) {
          console.log(`     Children: ${field.children.map((c) => `${c.title} (${c.type})`).join(", ")}`);
        }
        console.log("");
      });
    } else {
      console.log("\n❌ No metafields found");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkFieldConfig();
