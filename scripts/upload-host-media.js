const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const https = require("https");
const http = require("http");

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
};

// Function to download image from URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

// Function to get database connection
async function getConnection() {
  return await mysql.createConnection(config.database);
}

// Function to get all host data with images from database
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

// Function to upload image to Cosmic
async function uploadImageToCosmic(imageUrl, fileName, cosmic) {
  try {
    console.log(`   📥 Downloading: ${fileName}`);

    // Download the image
    const imageBuffer = await downloadImage(imageUrl);

    console.log(`   📤 Uploading to Cosmic: ${fileName}`);

    // Upload to Cosmic
    const result = await cosmic.media.insertOne({
      media: {
        originalname: fileName,
        buffer: imageBuffer,
      },
      folder: "host-profiles",
    });

    console.log(`   ✅ Uploaded: ${result.media.name}`);
    return result.media.name;
  } catch (error) {
    console.error(`   ❌ Error uploading ${fileName}:`, error.message);
    return null;
  }
}

// Function to get existing media from Cosmic
async function getExistingMedia(cosmic) {
  try {
    const response = await cosmic.media.find().limit(1000);
    return response.media || [];
  } catch (error) {
    console.error("❌ Error fetching existing media:", error);
    return [];
  }
}

// Function to get all hosts from Cosmic
async function getCosmicHosts(cosmic) {
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

// Function to update host with media
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

  console.log("🎯 Host Media Upload Script");
  console.log("============================");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  // Initialize Cosmic client
  const cosmic = createBucketClient(config.cosmic);

  try {
    // Step 1: Get host data with images from database
    console.log("📋 Step 1: Getting host data from database...");
    const hostData = await getHostDataWithImages();
    console.log(`   Found ${hostData.length} hosts with images`);

    // Step 2: Get existing media from Cosmic
    console.log("\n📋 Step 2: Getting existing media from Cosmic...");
    const existingMedia = await getExistingMedia(cosmic);
    console.log(`   Found ${existingMedia.length} existing media files`);

    // Step 3: Get existing hosts from Cosmic
    console.log("\n📋 Step 3: Getting hosts from Cosmic...");
    const cosmicHosts = await getCosmicHosts(cosmic);
    console.log(`   Found ${cosmicHosts.length} hosts in Cosmic`);

    // Step 4: Upload missing media and link to hosts
    console.log("\n📋 Step 4: Processing media uploads and links...");

    let uploadedCount = 0;
    let linkedCount = 0;
    let skippedCount = 0;

    for (const hostInfo of hostData) {
      console.log(`\n🔄 Processing: ${hostInfo.title} (${hostInfo.slug})`);

      if (!hostInfo.image) {
        console.log(`   ⚠️ No image found for ${hostInfo.title}`);
        skippedCount++;
        continue;
      }

      // Find corresponding Cosmic host
      const cosmicHost = cosmicHosts.find((h) => h.slug === hostInfo.slug);
      if (!cosmicHost) {
        console.log(`   ⚠️ No matching Cosmic host found for ${hostInfo.slug}`);
        skippedCount++;
        continue;
      }

      // Check if media already exists in Cosmic
      const existingMediaFile = existingMedia.find((m) => m.original_name === hostInfo.image.filename || m.name === hostInfo.image.filename);

      let mediaName = null;

      if (existingMediaFile) {
        console.log(`   ✅ Media already exists: ${existingMediaFile.name}`);
        mediaName = existingMediaFile.name;
      } else {
        // Upload new media
        if (!isDryRun) {
          mediaName = await uploadImageToCosmic(hostInfo.image.url, hostInfo.image.filename, cosmic);
          if (mediaName) {
            uploadedCount++;
          }
        } else {
          console.log(`   🔍 Would upload: ${hostInfo.image.filename}`);
          mediaName = hostInfo.image.filename; // Simulate for dry run
        }
      }

      // Link media to host if we have a media name
      if (mediaName) {
        // Check if host already has this image
        const currentImage = cosmicHost.metadata?.image;
        if (currentImage && (currentImage === mediaName || currentImage.name === mediaName)) {
          console.log(`   ✅ Host already has correct image linked`);
        } else {
          if (!isDryRun) {
            const success = await updateHostWithMedia(cosmic, cosmicHost.id, mediaName);
            if (success) {
              console.log(`   ✅ Linked media to host: ${mediaName}`);
              linkedCount++;
            }
          } else {
            console.log(`   🔍 Would link media to host: ${mediaName}`);
            linkedCount++;
          }
        }
      } else {
        skippedCount++;
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log(`   📤 Media uploaded: ${uploadedCount}`);
    console.log(`   🔗 Hosts linked: ${linkedCount}`);
    console.log(`   ⚠️ Skipped: ${skippedCount}`);
    console.log(`   📦 Total processed: ${hostData.length}`);

    if (isDryRun) {
      console.log("\n🔍 This was a dry run. Use --live to actually upload and link media.");
    } else {
      console.log("\n🎉 Media upload and linking process completed!");
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
