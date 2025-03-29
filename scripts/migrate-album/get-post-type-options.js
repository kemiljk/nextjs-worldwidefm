// Script to get valid post type options
require("dotenv").config({ path: ".env.local" });
const { createBucketClient } = require("@cosmicjs/sdk");

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

async function getPostTypeOptions() {
  try {
    // Get the object type for posts
    const response = await cosmic.objectTypes.findOne({ slug: "posts" });

    if (!response.object_type) {
      console.log("Could not find posts object type");
      return;
    }

    // Find the 'type' metafield
    const typeMetafield = response.object_type.metafields.find((field) => field.key === "type");

    if (!typeMetafield) {
      console.log("Could not find 'type' metafield in posts object type");
      return;
    }

    console.log("Type metafield configuration:");
    console.log(JSON.stringify(typeMetafield, null, 2));

    // If it's a select-dropdown, list the options
    if (typeMetafield.type === "select-dropdown" && typeMetafield.options) {
      console.log("\nValid type options:");
      typeMetafield.options.forEach((option) => {
        console.log(`- key: "${option.key}", value: "${option.value}"`);
      });
    }
  } catch (error) {
    console.error("Error getting post type options:", error);
  }
}

getPostTypeOptions();
