const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");
const fs = require("fs").promises;

// Cosmic configuration
const COSMIC_CONFIG = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

// Initialize Cosmic client with write access
const cosmic = createBucketClient({
  bucketSlug: COSMIC_CONFIG.bucketSlug,
  readKey: COSMIC_CONFIG.readKey,
  writeKey: COSMIC_CONFIG.writeKey,
});

function generateSlug(title) {
  if (!title) return "";

  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

async function populateCosmicCategories() {
  try {
    console.log("Starting Cosmic category population...");

    // Read classification data
    const classificationsPath = path.join(__dirname, "llm_genre_classifications.json");
    const data = await fs.readFile(classificationsPath, "utf8");
    const classifications = JSON.parse(data);
    console.log(`Read ${classifications.length} classifications from ${classificationsPath}`);

    // Process classifications and create Cosmic objects
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const classification of classifications) {
      const originalTerm = classification.original_term;
      const type = classification.classification;
      const standardizedGenreName = classification.standardized_genre_name;

      let targetType = null;
      let title = null;

      switch (type) {
        case "Music Genre":
          targetType = "genres";
          title = standardizedGenreName || originalTerm;
          break;
        case "Person Name":
          targetType = "regular-hosts";
          title = originalTerm;
          break;
        case "Location":
          targetType = "locations";
          title = originalTerm;
          break;
        case "Organization/Label":
          targetType = "takeovers";
          title = originalTerm;
          break;
        case "Content Type/Format":
        case "Other":
          console.log(`Skipping classification '${originalTerm}' with type '${type}'`);
          skippedCount++;
          continue; // Skip these types
        default:
          console.warn(`Unknown classification type: '${type}' for term '${originalTerm}'`);
          skippedCount++;
          continue; // Skip unknown types
      }

      if (!title) {
        console.warn(`Skipping classification with no title for type '${type}' and original term '${originalTerm}'`);
        skippedCount++;
        continue;
      }

      const slug = generateSlug(title);

      try {
        // Check if object already exists
        const { objects } = await cosmic.objects
          .find({
            type: targetType,
            slug: slug,
          })
          .limit(1); // Limit to 1 as we only need to know if it exists

        if (objects && objects.length > 0) {
          console.log(`Object with slug '${slug}' already exists in type '${targetType}'. Skipping creation.`);
          skippedCount++;
        } else {
          // Create the new object
          console.log(`Creating new object in type '${targetType}' with title '${title}' and slug '${slug}'`);
          await cosmic.objects.insertOne({
            title: title,
            type: targetType,
            slug: slug,
            status: "published", // Assuming we want to publish them immediately
          });
          console.log(`Successfully created object for '${title}'`);
          createdCount++;
        }
      } catch (error) {
        console.error(`Error processing '${originalTerm}' (type: ${type}, target: ${targetType}):`, error.message);
        if (error.response) {
          console.error("Error response data:", error.response.data);
        }
        errorCount++;
      }
    }

    console.log("\nCosmic category population finished.");
    console.log(`Summary: Created: ${createdCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error("Error during Cosmic category population:", error);
  }
}

populateCosmicCategories();
