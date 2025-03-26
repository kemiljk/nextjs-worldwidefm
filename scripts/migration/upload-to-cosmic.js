const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");
const fs = require("fs");
const fsp = require("fs").promises;

// Configuration
const config = {
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "worldwide-fm-production",
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  downloadDir: path.join(__dirname, "downloads"),
};

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function checkIfImageExists(filename) {
  try {
    // Search for media with the same filename
    const media = await cosmic.media.find({
      query: {
        originalname: filename,
      },
    });

    if (media.media && media.media.length > 0) {
      return media.media[0];
    }

    return null;
  } catch (error) {
    console.error(`Failed to check if ${filename} exists in Cosmic:`, error.message);
    return null;
  }
}

async function uploadToCosmic(filepath, filename) {
  try {
    // Check if image already exists in Cosmic
    const existingMedia = await checkIfImageExists(filename);
    if (existingMedia) {
      console.log(`↷ Skipping ${filename} - already exists in Cosmic (ID: ${existingMedia.id})`);
      return existingMedia;
    }

    console.log(`Uploading ${filename} to Cosmic...`);
    const file = await fsp.readFile(filepath);
    const media = await cosmic.media.insertOne({
      media: {
        originalname: filename,
        buffer: file,
      },
    });
    console.log(`✓ Uploaded ${filename} successfully`);
    return media;
  } catch (error) {
    console.error(`Failed to upload ${filename} to Cosmic:`, error.message);
    return null;
  }
}

async function findMatchingObjects(filename) {
  try {
    // Remove file extension for matching
    const baseFilename = filename.replace(/\.[^/.]+$/, "");

    // Search in articles
    const articles = await cosmic.objects.find({
      type: "articles",
      props: "id,title,slug,metadata",
      query: {
        $or: [{ "metadata.title": { $regex: baseFilename, $options: "i" } }, { slug: { $regex: baseFilename, $options: "i" } }],
      },
    });

    // Search in radio shows
    const shows = await cosmic.objects.find({
      type: "radio-shows",
      props: "id,title,slug,metadata",
      query: {
        $or: [{ "metadata.title": { $regex: baseFilename, $options: "i" } }, { slug: { $regex: baseFilename, $options: "i" } }],
      },
    });

    return [...articles.objects, ...shows.objects];
  } catch (error) {
    console.error(`Failed to find matching objects for ${filename}:`, error.message);
    return [];
  }
}

async function updateObject(object, mediaId) {
  try {
    console.log(`Updating ${object.type} "${object.title}" with media ${mediaId}...`);
    await cosmic.objects.update(object.id, {
      metadata: {
        ...object.metadata,
        thumbnail: {
          id: mediaId,
          imgix_url: `https://imgix.cosmicjs.com/${mediaId}`,
        },
      },
    });
    console.log(`✓ Updated ${object.type} successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to update ${object.type} ${object.title}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("\n=== Starting Cosmic Upload ===\n");

  try {
    // Get list of downloaded images
    const files = await fsp.readdir(config.downloadDir);
    console.log(`Found ${files.length} files in downloads directory\n`);

    let uploadedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process each file
    for (const filename of files) {
      console.log(`\nProcessing ${filename}...`);

      // Upload to Cosmic
      const filepath = path.join(config.downloadDir, filename);
      const media = await uploadToCosmic(filepath, filename);
      if (!media) {
        errorCount++;
        continue;
      }
      uploadedCount++;

      // Find matching objects
      const objects = await findMatchingObjects(filename);
      console.log(`Found ${objects.length} matching objects`);

      // Update each matching object
      for (const object of objects) {
        const success = await updateObject(object, media.id);
        if (success) updatedCount++;
        else errorCount++;
      }
    }

    console.log("\n=== Upload Summary ===");
    console.log(`Files processed: ${files.length}`);
    console.log(`Images uploaded: ${uploadedCount}`);
    console.log(`Objects updated: ${updatedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log("\nUpload complete!\n");
  } catch (error) {
    console.error("Failed to process files:", error.message);
  }
}

main().catch(console.error);
