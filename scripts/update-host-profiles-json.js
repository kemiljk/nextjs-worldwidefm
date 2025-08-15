const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const fs = require("fs").promises;
const axios = require("axios");
const { createBucketClient } = require("@cosmicjs/sdk");

const config = {
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
  downloadDir: path.join(__dirname, "downloads"),
};

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function ensureDownloadDir() {
  try {
    await fs.access(config.downloadDir);
  } catch {
    await fs.mkdir(config.downloadDir, { recursive: true });
  }
}

async function fetchCollectionsFromJSON() {
  try {
    console.log("🔍 Loading Collections from JSON export...");

    // Read the JSON file
    const jsonPath = path.join(__dirname, "categories.json");
    const jsonData = await fs.readFile(jsonPath, "utf8");
    const allCategories = JSON.parse(jsonData);

    console.log(`✅ Loaded ${allCategories.length} total categories from JSON`);

    // Filter for only collectionCategories (groupId=2) - these are the actual host collections
    const collectionCategories = allCategories.filter((category) => category.groupId === "2");
    console.log(`🎯 Found ${collectionCategories.length} collection categories (host collections)`);

    // Filter collections that have images (thumbnail array with asset IDs)
    const collectionsWithImages = collectionCategories.filter((collection) => collection.thumbnail && Array.isArray(collection.thumbnail) && collection.thumbnail.length > 0);
    const collectionsWithoutImages = collectionCategories.filter((collection) => !collection.thumbnail || !Array.isArray(collection.thumbnail) || collection.thumbnail.length === 0);

    console.log(`📸 ${collectionsWithImages.length} collection categories have images`);
    console.log(`❌ ${collectionsWithoutImages.length} collection categories don't have images`);

    // Show some collections without images for debugging
    if (collectionsWithoutImages.length > 0) {
      console.log(`\n🔍 Collection categories without images (first 10):`);
      collectionsWithoutImages.slice(0, 10).forEach((collection) => {
        console.log(`   - ${collection.title} (${collection.slug})`);
      });
      if (collectionsWithoutImages.length > 10) {
        console.log(`   ... and ${collectionsWithoutImages.length - 10} more`);
      }
    }

    return collectionsWithImages;
  } catch (error) {
    console.error("❌ Failed to load collections from JSON:", error.message);
    return [];
  }
}

async function getExistingCosmicMedia() {
  try {
    console.log("📋 Fetching existing media batch: skip=0, limit=1000");
    const response = await cosmic.media.find({
      query: {},
      props: "id,name,original_name,url,imgix_url",
      limit: 1000,
    });

    if (response.objects && response.objects.length > 0) {
      const mediaMap = new Map();
      response.objects.forEach((media) => {
        if (media.original_name) {
          mediaMap.set(media.original_name.toLowerCase(), media);
        }
      });
      console.log(`✅ Found ${mediaMap.size} existing media items`);
      return mediaMap;
    } else {
      console.log("❌ Error fetching existing media: No media found in bucket 'worldwide-fm-production'");
      return new Map();
    }
  } catch (error) {
    console.error("❌ Error fetching existing media:", error.message);
    return new Map();
  }
}

async function getCosmicRegularHosts() {
  try {
    const response = await cosmic.objects.find({
      query: { type: "regular-hosts" },
      props: "id,title,slug,metadata,thumbnail",
      limit: 1000,
    });

    if (response.objects) {
      console.log(`✅ Found ${response.objects.length} regular hosts in Cosmic`);
      return response.objects;
    } else {
      console.log("❌ No regular hosts found in Cosmic");
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching regular hosts:", error.message);
    return [];
  }
}

async function downloadImage(imageUrl, filename) {
  try {
    const filepath = path.join(config.downloadDir, filename);

    // Check if file already exists
    try {
      await fs.access(filepath);
      console.log(`   📁 Image already exists: ${filename}`);
      return filepath;
    } catch {
      // File doesn't exist, download it
    }

    console.log(`   📥 Downloading: ${filename}`);
    const response = await axios({
      url: imageUrl,
      method: "GET",
      responseType: "arraybuffer",
      timeout: 30000,
    });

    await fs.writeFile(filepath, response.data);
    console.log(`   ✅ Downloaded: ${filename}`);
    return filepath;
  } catch (error) {
    console.error(`   ❌ Failed to download ${filename}:`, error.message);
    return null;
  }
}

async function uploadImageToCosmic(filepath, filename, title) {
  try {
    console.log(`   🚀 Uploading to Cosmic: ${filename}`);

    // Read the file
    const fileBuffer = await fs.readFile(filepath);

    // Determine MIME type
    const mimeType = getMimeType(filename);

    // Create media object for Cosmic
    const mediaData = {
      originalname: filename,
      buffer: fileBuffer,
      mimetype: mimeType,
    };

    const result = await cosmic.media.insertOne(mediaData);

    if (result && result.object) {
      console.log(`   ✅ Uploaded to Cosmic: ${filename}`);
      return result.object;
    } else {
      console.log(`   ❌ Failed to upload ${filename}: No result object`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Failed to upload ${filename}:`, error.message);
    return null;
  }
}

function getMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return mimeTypes[ext] || "image/jpeg";
}

async function updateHostWithImage(host, mediaItem, description) {
  try {
    console.log(`   🔄 Updating host: ${host.title}`);
    console.log(`   📸 Media item:`, JSON.stringify(mediaItem, null, 2));
    if (description) {
      console.log(`   📝 Description: ${description}`);
    }

    // Prepare update data
    const updateData = {
      title: host.title,
      metadata: {
        ...host.metadata,
        image: mediaItem.id, // Set the media ID
        description: description || null, // Add description to metadata
      },
      thumbnail: mediaItem.name, // thumbnail is not metadata
    };

    console.log(`   📝 Update data:`, JSON.stringify(updateData, null, 2));

    // Update the object
    const result = await cosmic.objects.updateOne(host.id, {
      title: updateData.title,
      metadata: updateData.metadata,
      thumbnail: updateData.thumbnail,
    });

    console.log(`   ✅ Successfully updated ${host.title} with image`);
    console.log(`   📊 Update result:`, JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating ${host.title}:`, error.message);
    if (error.response) {
      console.error(`   📡 Response status:`, error.response.status);
      console.error(`   📡 Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function processCollections() {
  try {
    await ensureDownloadDir();

    // Get existing media to avoid re-uploading
    const existingMediaMap = await getExistingCosmicMedia();

    // Get collections from JSON
    const collections = await fetchCollectionsFromJSON();

    if (collections.length === 0) {
      console.log("❌ No collections found to process");
      return;
    }

    // Get existing hosts from Cosmic
    const cosmicHosts = await getCosmicRegularHosts();

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let noMatch = 0;

    // Filter to only process collections that have matching hosts in Cosmic
    const processableCollections = collections.filter((collection) => {
      const matchingHost = cosmicHosts.find((host) => {
        // Try to match on title first (more likely to be similar)
        const titleMatch = host.title.toLowerCase() === collection.title.toLowerCase();
        // Fallback to slug match
        const slugMatch = host.slug === collection.slug;

        // Debug: Log WW Berlin specifically
        if (collection.title === "WW Berlin" || host.title === "WW Berlin") {
          console.log(`🔍 Debug WW Berlin matching:`);
          console.log(`   Craft CMS: "${collection.title}" (${collection.slug})`);
          console.log(`   Cosmic: "${host.title}" (${host.slug})`);
          console.log(`   Title match: ${titleMatch}`);
          console.log(`   Slug match: ${slugMatch}`);
        }

        return titleMatch || slugMatch;
      });
      return matchingHost !== undefined;
    });

    console.log(`\n🎯 Found ${processableCollections.length} collections with matching Cosmic hosts out of ${collections.length} total`);

    for (const collection of processableCollections) {
      console.log(`\n🎯 Processing collection: ${collection.title} (${collection.slug})`);

      // Find matching host in Cosmic by title first, then slug
      const matchingHost = cosmicHosts.find((host) => {
        const titleMatch = host.title.toLowerCase() === collection.title.toLowerCase();
        const slugMatch = host.slug === collection.slug;
        return titleMatch || slugMatch;
      });

      if (!matchingHost) {
        console.log(`   ⚠️ No matching host found for: ${collection.title}`);
        noMatch++;
        continue;
      }

      // Check if host already has a valid image
      if (matchingHost.metadata?.image && matchingHost.metadata.image.url) {
        console.log(`   ✅ Host already has image: ${matchingHost.metadata.image.url}`);
        skipped++;
        continue;
      } else {
        console.log(`   🔍 Host needs image update. Current metadata:`, JSON.stringify(matchingHost.metadata?.image || null));
      }

      // For now, we'll skip processing since we need to handle the asset ID structure
      // The thumbnail field contains asset IDs like ["120801"] not direct URLs
      console.log(`   ⚠️ Skipping for now - thumbnail contains asset IDs: ${JSON.stringify(collection.thumbnail)}`);
      skipped++;
      continue;
    }

    // Show hosts that still need images
    const hostsWithoutImages = cosmicHosts.filter((host) => !host.metadata?.image || !host.metadata.image.url);

    console.log(`\n📊 Processing Summary:`);
    console.log(`   🎯 Total collections: ${collections.length}`);
    console.log(`   🎯 Processable collections: ${processableCollections.length}`);
    console.log(`   ✅ Updated hosts: ${updated}`);
    console.log(`   ⏭️ Skipped (already have images): ${skipped}`);
    console.log(`   ❌ No matching host: ${noMatch}`);
    console.log(`   📦 Total processed: ${processed}`);
    console.log(`   ❌ Hosts still without images: ${hostsWithoutImages.length}`);

    if (hostsWithoutImages.length > 0) {
      console.log(`\n🔍 Hosts that still need images:`);
      hostsWithoutImages.slice(0, 10).forEach((host) => {
        console.log(`   - ${host.title} (${host.slug})`);
      });
      if (hostsWithoutImages.length > 10) {
        console.log(`   ... and ${hostsWithoutImages.length - 10} more`);
      }
    }
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

async function main() {
  console.log("🎵 Starting collection image update process (JSON version)...");
  console.log("📁 Download directory:", config.downloadDir);

  try {
    await processCollections();
    console.log("\n🎉 Collection image update process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, processCollections };
