const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const axios = require("axios");
const fs = require("fs").promises;
const { createBucketClient } = require("@cosmicjs/sdk");

const config = {
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  downloadDir: path.join(__dirname, "downloads"),
};

// Validate configuration
if (!config.cosmic.bucketSlug || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration:");
  if (!config.cosmic.bucketSlug) console.error("- NEXT_PUBLIC_COSMIC_BUCKET_SLUG is not set");
  if (!config.cosmic.writeKey) console.error("- COSMIC_WRITE_KEY is not set");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function ensureDownloadDir() {
  try {
    await fs.access(config.downloadDir);
  } catch {
    await fs.mkdir(config.downloadDir, { recursive: true });
  }
}

async function fetchCollectionsFromCraft() {
  try {
    console.log("🔍 Fetching Collections from Craft CMS via GraphQL...");

    const query = `
      query {
        categories(limit: 1000) {
          id
          title
          slug
          groupId
          description
          thumbnail {
            url
            filename
            id
          }
        }
      }
    `;

    const response = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query },
      timeout: 30000,
    });

    if (response.data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
      throw new Error(JSON.stringify(response.data.errors, null, 2));
    }

    const allCategories = response.data.data.categories || [];
    console.log(`✅ Found ${allCategories.length} total categories from Craft CMS`);

    // Show breakdown by category group
    const categoryGroups = [...new Set(allCategories.map((cat) => cat.groupId))];
    console.log(`📋 Available category group IDs: ${categoryGroups.join(", ")}`);

    categoryGroups.forEach((groupId) => {
      const groupCategories = allCategories.filter((cat) => cat.groupId === groupId);
      const groupWithImages = groupCategories.filter((cat) => cat.thumbnail);
      console.log(`🔍 Group ${groupId}: ${groupCategories.length} categories (${groupWithImages.length} with images)`);
    });

    // Filter for only collectionCategories (groupId=2) - these are the actual host collections
    const collectionCategories = allCategories.filter((category) => category.groupId === 2);
    console.log(`\n🎯 Found ${collectionCategories.length} collection categories (host collections)`);

    // Filter collections that have images
    const collectionsWithImages = collectionCategories.filter((collection) => collection.thumbnail);
    const collectionsWithoutImages = collectionCategories.filter((collection) => !collection.thumbnail);

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
    console.error("❌ Failed to fetch collections from Craft:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
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

    const fileBuffer = await fs.readFile(filepath);

    // Detect image type from filename extension
    const ext = path.extname(filename).toLowerCase();
    let mimeType = "image/jpeg"; // default

    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".svg") mimeType = "image/svg+xml";

    // Create a file-like object for Cosmic SDK
    const file = {
      originalname: filename,
      buffer: fileBuffer,
    };

    const response = await cosmic.media.insertOne({
      media: file,
    });

    if (response && response.media) {
      console.log(`   ✅ Uploaded to Cosmic: ${response.media.original_name}`);
      return response.media;
    } else {
      console.error(`   ❌ Invalid response from Cosmic for ${filename}`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Failed to upload ${filename} to Cosmic:`, error.message);
    return null;
  }
}

async function getExistingCosmicMedia() {
  try {
    const mediaMap = new Map();
    let skip = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      console.log(`📋 Fetching existing media batch: skip=${skip}, limit=${limit}`);

      const response = await cosmic.media.find({
        skip,
        limit,
        props: "id,original_name,name,url,imgix_url",
      });

      if (!response || !response.media) {
        console.error("Invalid media response format:", response);
        break;
      }

      const mediaItems = response.media;
      console.log(`   Found ${mediaItems.length} media items in this batch`);

      mediaItems.forEach((item) => {
        if (item.original_name) {
          // Store by filename for matching
          const filename = path.basename(item.original_name);
          mediaMap.set(filename.toLowerCase(), item);
          mediaMap.set(item.original_name, item);
        }
      });

      if (mediaItems.length < limit) {
        hasMore = false;
      } else {
        skip += limit;
      }
    }

    console.log(`   Total existing media items: ${mediaMap.size}`);
    return mediaMap;
  } catch (error) {
    console.error("❌ Error fetching existing media:", error.message);
    return new Map();
  }
}

async function getCosmicRegularHosts() {
  try {
    console.log("📋 Fetching existing regular hosts from Cosmic...");

    const response = await cosmic.objects.find({
      type: "regular-hosts",
      status: "published",
      props: "id,slug,title,metadata",
    });

    const hosts = response.objects || [];
    console.log(`✅ Found ${hosts.length} regular hosts in Cosmic`);

    return hosts;
  } catch (error) {
    console.error("❌ Error fetching Cosmic hosts:", error.message);
    return [];
  }
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

    // Get collections from Craft CMS
    const collections = await fetchCollectionsFromCraft();

    if (collections.length === 0) {
      console.log("❌ No collections found to process");
      return;
    }

    // Get existing hosts from Cosmic
    const cosmicHosts = await getCosmicRegularHosts();

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    for (const collection of collections) {
      console.log(`\n🎯 Processing collection: ${collection.title} (${collection.slug})`);

      // Find matching host in Cosmic by slug
      const matchingHost = cosmicHosts.find((host) => host.slug === collection.slug);

      if (!matchingHost) {
        console.log(`   ⚠️ No matching host found for: ${collection.title}`);
        skipped++;
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

      const thumbnail = collection.thumbnail;
      let image = null;

      // Handle thumbnail as either single object or array
      if (Array.isArray(thumbnail) && thumbnail.length > 0) {
        image = thumbnail[0]; // Take first image from array
      } else if (thumbnail && typeof thumbnail === "object") {
        image = thumbnail; // Single image object
      }

      if (!image || !image.url || !image.filename) {
        console.log(`   ⚠️ No valid image found for collection: ${collection.title}`);
        skipped++;
        continue;
      }

      // Check if image already exists in Cosmic
      const existingMedia = existingMediaMap.get(image.filename.toLowerCase());
      let mediaItem = existingMedia;

      if (!existingMedia) {
        // Download and upload image
        const filepath = await downloadImage(image.url, image.filename);
        if (!filepath) {
          console.log(`   ❌ Failed to download image for: ${collection.title}`);
          continue;
        }

        mediaItem = await uploadImageToCosmic(filepath, image.filename, collection.title);
        if (!mediaItem) {
          console.log(`   ❌ Failed to upload image for: ${collection.title}`);
          continue;
        }
      } else {
        console.log(`   📁 Image already exists in Cosmic: ${image.filename}`);
      }

      // Update host with image and description
      const success = await updateHostWithImage(matchingHost, mediaItem, collection.description);
      if (success) {
        updated++;
      }

      processed++;
    }

    // Show hosts that still need images
    const hostsWithoutImages = cosmicHosts.filter((host) => !host.metadata?.image || !host.metadata.image.url);

    console.log(`\n📊 Processing Summary:`);
    console.log(`   🎯 Total collections: ${collections.length}`);
    console.log(`   ✅ Updated hosts: ${updated}`);
    console.log(`   ⏭️ Skipped (already have images): ${skipped}`);
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
  console.log("🎵 Starting collection image update process...");
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
