const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const fs = require("fs");
const fsp = require("fs").promises;
const axios = require("axios");

// Configuration
const config = {
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  downloadDir: path.join(__dirname, "downloads"),
};

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function ensureDownloadDir() {
  try {
    await fsp.access(config.downloadDir);
  } catch {
    await fsp.mkdir(config.downloadDir, { recursive: true });
  }
}

async function getConnection() {
  return await mysql.createConnection(config.database);
}

// Get host data with images from database (reusing our existing logic)
async function getHostDataWithImages() {
  const connection = await getConnection();

  try {
    // First, get the field ID for episodeCollection
    const [episodeCollectionField] = await connection.execute(`
      SELECT id FROM craft_fields WHERE handle = 'episodeCollection'
    `);

    if (episodeCollectionField.length === 0) {
      console.log("❌ episodeCollection field not found");
      return [];
    }

    const fieldId = episodeCollectionField[0].id;

    // Get all collection categories
    const [collectionCategories] = await connection.execute(`
      SELECT 
        c.*,
        cc.title,
        s.slug,
        cg.name as group_name,
        cg.handle as group_handle
      FROM craft_categories c
      JOIN craft_content cc ON c.id = cc.elementId
      JOIN craft_elements_sites s ON c.id = s.elementId
      JOIN craft_categorygroups cg ON c.groupId = cg.id
      WHERE cg.handle = 'collectionCategories'
      AND s.siteId = 1
      ORDER BY cc.title
    `);

    const hostData = [];

    // For each collection category, find episodes that belong to it
    for (const category of collectionCategories) {
      // Find episodes linked to this collection
      const [episodeRelations] = await connection.execute(
        `
        SELECT 
          r.sourceId as episode_id,
          e.id,
          c.title as episode_title,
          s.slug as episode_slug
        FROM craft_relations r
        JOIN craft_entries e ON r.sourceId = e.id
        JOIN craft_content c ON e.id = c.elementId
        JOIN craft_elements_sites s ON e.id = s.elementId
        JOIN craft_sections sec ON e.sectionId = sec.id
        WHERE r.fieldId = ? 
        AND r.targetId = ?
        AND sec.handle = 'episode'
        AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
        AND s.siteId = 1
        ORDER BY e.dateCreated DESC
        LIMIT 1
      `,
        [fieldId, category.id]
      );

      if (episodeRelations.length > 0) {
        const firstEpisode = episodeRelations[0];

        // Look for thumbnail/profile image
        const [thumbnailField] = await connection.execute(`
          SELECT id FROM craft_fields WHERE handle = 'thumbnail'
        `);

        let profileImage = null;
        if (thumbnailField.length > 0) {
          const [thumbnailAssets] = await connection.execute(
            `
            SELECT 
              a.filename,
              v.url as base_url,
              CONCAT(v.url, a.filename) as full_url
            FROM craft_relations r
            JOIN craft_assets a ON r.targetId = a.id
            JOIN craft_volumes v ON a.volumeId = v.id
            WHERE r.sourceId = ? 
            AND r.fieldId = ?
            ORDER BY r.sortOrder
            LIMIT 1
          `,
            [firstEpisode.episode_id, thumbnailField[0].id]
          );

          if (thumbnailAssets.length > 0) {
            const asset = thumbnailAssets[0];
            profileImage = {
              url: asset.full_url,
              filename: asset.filename,
            };
          }
        }

        if (profileImage) {
          hostData.push({
            slug: category.slug,
            title: category.title,
            image: profileImage,
          });
        }
      }
    }

    return hostData;
  } finally {
    await connection.end();
  }
}

// Download image from URL (following the migration pattern)
async function downloadImage(url, filename) {
  try {
    const filepath = path.join(config.downloadDir, filename);

    // Check if file already exists
    try {
      await fsp.access(filepath);
      console.log(`  ↷ Skipping ${filename} - already downloaded`);
      return filepath;
    } catch {
      // File doesn't exist, proceed with download
      console.log(`  📥 Downloading: ${filename}`);
    }

    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 30000,
      maxRedirects: 5,
    });

    if (response.status !== 200) {
      console.log(`  ❌ Failed to download: HTTP ${response.status}`);
      return null;
    }

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`  ✅ Downloaded: ${filepath}`);
        resolve(filepath);
      });
      writer.on("error", (err) => {
        console.log(`  ❌ Error writing file: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    console.log(`  ❌ Error downloading: ${error.message}`);
    return null;
  }
}

// Upload to Cosmic (following the migration pattern)
async function uploadToCosmic(filepath, filename, existingMediaMap) {
  try {
    // Check if file already exists in Cosmic
    if (existingMediaMap.has(filename.toLowerCase())) {
      const existingMedia = existingMediaMap.get(filename.toLowerCase());
      console.log(`  ✅ Using existing Cosmic media: ${existingMedia.name}`);
      return existingMedia;
    }

    console.log(`  📤 Uploading to Cosmic: ${filename}`);
    const file = await fsp.readFile(filepath);

    const media = await cosmic.media.insertOne({
      media: {
        originalname: filename,
        buffer: file,
      },
      folder: "host-profiles",
    });

    console.log(`  ✅ Uploaded successfully: ${media.media.name}`);
    return media.media;
  } catch (error) {
    console.error(`  ❌ Failed to upload ${filename}:`, error.message);
    return null;
  }
}

// Get existing media from Cosmic (following the migration pattern)
async function getExistingCosmicMedia() {
  try {
    const mediaMap = new Map();
    let skip = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      console.log(`📋 Fetching media batch: skip=${skip}, limit=${limit}`);

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
          // Store both original and lowercase versions for matching
          mediaMap.set(item.original_name.toLowerCase(), item);
          mediaMap.set(item.original_name, item);

          // Also try with the name field
          if (item.name) {
            mediaMap.set(item.name.toLowerCase(), item);
            mediaMap.set(item.name, item);
          }

          // Try with just the filename part
          const filename = item.original_name.split("/").pop();
          if (filename) {
            mediaMap.set(filename.toLowerCase(), item);
            mediaMap.set(filename, item);
          }
        }
      });

      if (mediaItems.length < limit) {
        hasMore = false;
      } else {
        skip += limit;
      }
    }

    console.log(`   Total unique media items mapped: ${mediaMap.size}`);
    return mediaMap;
  } catch (error) {
    console.error("❌ Error fetching existing media:", error.message);
    return new Map();
  }
}

// Get all hosts from Cosmic
async function getCosmicHosts() {
  try {
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
      })
      .props("id,slug,title,metadata")
      .limit(1000);

    return response.objects || [];
  } catch (error) {
    console.error("❌ Error fetching hosts:", error);
    return [];
  }
}

// Update host with media (following the migration pattern)
async function updateHostWithMedia(cosmic, hostId, mediaName) {
  try {
    await cosmic.objects.updateOne(hostId, {
      metadata: {
        image: mediaName,
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
  const isDryRun = process.argv.includes("--dry-run");

  console.log("🎯 Host Image Migration Script");
  console.log("==============================");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  try {
    // Ensure download directory exists
    await ensureDownloadDir();
    console.log(`✅ Download directory ready: ${config.downloadDir}\n`);

    // Step 1: Get host data with images from database
    console.log("📋 Step 1: Getting host data from database...");
    const hostData = await getHostDataWithImages();
    console.log(`   Found ${hostData.length} hosts with images\n`);

    // Step 2: Get existing media from Cosmic
    console.log("📋 Step 2: Getting existing media from Cosmic...");
    const existingMediaMap = await getExistingCosmicMedia();
    console.log("");

    // Step 3: Get existing hosts from Cosmic
    console.log("📋 Step 3: Getting hosts from Cosmic...");
    const cosmicHosts = await getCosmicHosts();
    console.log(`   Found ${cosmicHosts.length} hosts in Cosmic\n`);

    // Step 4: Process each host
    console.log("📋 Step 4: Processing host images...");

    let downloadedCount = 0;
    let uploadedCount = 0;
    let linkedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const hostInfo of hostData) {
      console.log(`\n🔄 Processing: ${hostInfo.title} (${hostInfo.slug})`);

      if (!hostInfo.image) {
        console.log(`   ⚠️ No image found`);
        skippedCount++;
        continue;
      }

      // Find corresponding Cosmic host
      const cosmicHost = cosmicHosts.find((h) => h.slug === hostInfo.slug);
      if (!cosmicHost) {
        console.log(`   ⚠️ No matching Cosmic host found`);
        skippedCount++;
        continue;
      }

      // Check if host already has an image
      if (cosmicHost.metadata?.image && cosmicHost.metadata.image !== "") {
        console.log(`   ✅ Host already has image: ${cosmicHost.metadata.image}`);
        continue;
      }

      if (isDryRun) {
        console.log(`   🔍 Would download: ${hostInfo.image.filename}`);
        console.log(`   🔍 Would upload to Cosmic`);
        console.log(`   🔍 Would link to host`);
        linkedCount++;
        continue;
      }

      // Download the image
      const filepath = await downloadImage(hostInfo.image.url, hostInfo.image.filename);
      if (!filepath) {
        errorCount++;
        continue;
      }
      downloadedCount++;

      // Upload to Cosmic
      const media = await uploadToCosmic(filepath, hostInfo.image.filename, existingMediaMap);
      if (!media) {
        errorCount++;
        continue;
      }
      uploadedCount++;

      // Link media to host
      const success = await updateHostWithMedia(cosmic, cosmicHost.id, media.name);
      if (success) {
        console.log(`   ✅ Linked media to host: ${media.name}`);
        linkedCount++;
      } else {
        errorCount++;
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log(`   📥 Images downloaded: ${downloadedCount}`);
    console.log(`   📤 Images uploaded: ${uploadedCount}`);
    console.log(`   🔗 Hosts linked: ${linkedCount}`);
    console.log(`   ⚠️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total processed: ${hostData.length}`);

    if (isDryRun) {
      console.log("\n🔍 This was a dry run. Use --live to actually download and upload images.");
    } else {
      console.log("\n🎉 Host image migration completed!");
    }
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
