const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const https = require("https");
const http = require("http");

const config = {
  mysql: {
    host: "localhost",
    user: "root",
    database: "worldwidefm",
  },
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

// Initialize clients

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function findHostDataFromEpisodes() {
  const connection = await getConnection();
  try {
    console.log("\n=== Finding Host Data from Episodes ===");

    // First, get the field ID for episodeCollection
    const [episodeCollectionField] = await connection.execute(`
      SELECT id FROM craft_fields WHERE handle = 'episodeCollection'
    `);

    if (episodeCollectionField.length === 0) {
      console.log("❌ episodeCollection field not found");
      return [];
    }

    const fieldId = episodeCollectionField[0].id;
    console.log(`📋 Found episodeCollection field ID: ${fieldId}`);

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

    console.log(`📦 Found ${collectionCategories.length} collection categories`);

    const hostData = [];

    // For each collection category, find episodes that belong to it
    for (const category of collectionCategories) {
      console.log(`\n🔍 Processing: ${category.title} (${category.slug})`);

      // Find episodes linked to this collection
      const [episodeRelations] = await connection.execute(
        `
        SELECT 
          r.sourceId as episode_id,
          e.id,
          c.title as episode_title,
          s.slug as episode_slug,
          c.field_bodyText,
          c.field_description,
          e.dateCreated
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
        LIMIT 50
      `,
        [fieldId, category.id]
      );

      if (episodeRelations.length > 0) {
        console.log(`   📻 Found ${episodeRelations.length} episodes for this collection`);

        // Get the most recent episode to extract host information
        const firstEpisode = episodeRelations[0];
        console.log(`   🎵 Most recent episode: ${firstEpisode.episode_title}`);

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
              imgix_url: asset.full_url,
              title: category.title,
              filename: asset.filename,
            };
            console.log(`   🖼️ Found profile image: ${asset.filename}`);
          }
        }

        // Extract description from bodyText
        let description = null;
        if (firstEpisode.field_bodyText) {
          // Clean HTML and extract meaningful description
          description = firstEpisode.field_bodyText
            .replace(/<[^>]*>/g, "") // Remove HTML tags
            .replace(/&[^;]+;/g, " ") // Remove HTML entities
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

          // Take first paragraph or first 300 characters for better descriptions
          const sentences = description.split(/[.!?]+/);
          if (sentences.length > 1) {
            description = sentences.slice(0, 2).join(". ").trim();
            if (!description.endsWith(".")) description += ".";
          } else if (description.length > 300) {
            description = description.substring(0, 300).trim() + "...";
          }

          if (description.length > 20) {
            console.log(`   📝 Extracted description: ${description.substring(0, 100)}...`);
          } else {
            description = null; // Too short to be useful
          }
        } else if (firstEpisode.field_description) {
          description = firstEpisode.field_description;
          console.log(`   📝 Found description field: ${description.substring(0, 100)}...`);
        }

        // Add to host data
        hostData.push({
          slug: category.slug,
          title: category.title,
          description: description,
          image: profileImage,
          episodeCount: episodeRelations.length,
          categoryId: category.id,
          firstEpisodeSlug: firstEpisode.episode_slug,
          lastEpisodeDate: firstEpisode.dateCreated,
          episodes: episodeRelations.map((ep) => ({
            title: ep.episode_title,
            slug: ep.episode_slug,
            dateCreated: ep.dateCreated,
          })),
        });

        console.log(`   ✅ Added host data for ${category.title}`);
      } else {
        console.log(`   ⚠️ No episodes found for ${category.title}`);
      }
    }

    return hostData;
  } finally {
    await connection.end();
  }
}

// Add function to download and upload image
async function uploadImageToCosmic(imageUrl, fileName, cosmic) {
  if (!imageUrl || !fileName) return null;

  try {
    console.log(`   📥 Downloading image: ${fileName}`);

    // Download the image
    const imageBuffer = await downloadImage(imageUrl);
    if (!imageBuffer) return null;

    console.log(`   📤 Uploading to Cosmic: ${fileName}`);

    // Upload to Cosmic
    const media = {
      originalname: fileName,
      buffer: imageBuffer,
    };

    const result = await cosmic.media.insertOne({
      media: media,
      folder: "host-profiles",
    });

    console.log(`   ✅ Uploaded successfully: ${result.media.name}`);
    return result.media.name;
  } catch (error) {
    console.error(`   ❌ Error uploading image ${fileName}:`, error.message);
    return null;
  }
}

// Function to download image from URL
function downloadImage(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          console.error(`   ❌ Failed to download image: ${response.statusCode}`);
          resolve(null);
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", (error) => {
        console.error(`   ❌ Download error:`, error.message);
        resolve(null);
      });
  });
}

async function createCosmicHosts(hostData, isDryRun = false) {
  console.log("\n=== Creating Cosmic Regular Hosts ===");
  console.log(`🔧 Mode: ${isDryRun ? "DRY RUN (no changes will be made)" : "LIVE (will create objects)"}`);

  // Initialize Cosmic client
  const cosmic = createBucketClient({
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  });

  try {
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const hostInfo of hostData) {
      console.log(`\n🔄 Creating: ${hostInfo.title} (${hostInfo.slug})`);

      let mediaName = null;

      // Upload image to Cosmic if we have one and not in dry run mode
      if (hostInfo.image && !isDryRun) {
        mediaName = await uploadImageToCosmic(hostInfo.image.url, hostInfo.image.filename, cosmic);
      }

      // Clean and validate description
      let cleanDescription = null;
      if (hostInfo.description) {
        // Clean the description: remove HTML tags, normalize whitespace, limit length
        cleanDescription = hostInfo.description
          .replace(/<[^>]*>/g, "") // Remove HTML tags
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim()
          .substring(0, 2000); // Limit to 2000 characters

        // Only use if it's meaningful (more than just a few characters)
        if (cleanDescription.length < 10) {
          cleanDescription = null;
        }
      }

      // Prepare object data for Cosmic
      const objectData = {
        type: "regular-hosts",
        title: hostInfo.title,
        slug: hostInfo.slug,
        status: "published",
        metadata: {
          description: cleanDescription || "",
          image: mediaName || "",
        },
      };

      // Log what we're creating
      console.log(`   📝 Description: ${cleanDescription ? `✅ "${cleanDescription.substring(0, 80)}..."` : "❌ None"}`);
      console.log(`   🖼️ Image: ${hostInfo.image ? `✅ ${hostInfo.image.filename}` : "❌ None"}`);

      if (!isDryRun) {
        // Create in Cosmic
        try {
          const result = await cosmic.objects.insertOne(objectData);
          created++;
          console.log(`   ✅ Successfully created ${hostInfo.title} (ID: ${result.object.id})`);
        } catch (error) {
          console.error(`   ❌ Error creating ${hostInfo.title}:`, error.message);

          // If it's a slug conflict, we can try to update instead
          if (error.message.includes("slug") || error.message.includes("unique")) {
            console.log(`   🔄 Slug conflict detected, trying to update existing object...`);
            try {
              // Try to find and update existing object
              const existing = await cosmic.objects.findOne({
                type: "regular-hosts",
                slug: hostInfo.slug,
              });

              if (existing.object) {
                await cosmic.objects.updateOne(existing.object.id, {
                  title: objectData.title,
                  content: objectData.content,
                  metadata: objectData.metadata,
                });
                created++;
                console.log(`   ✅ Updated existing object instead: ${hostInfo.title}`);
              }
            } catch (updateError) {
              console.error(`   ❌ Update also failed:`, updateError.message);
              errors++;
            }
          } else {
            errors++;
          }
        }
      } else {
        // Dry run - just show what would be created
        console.log(`   🔍 Would create regular-hosts object with:`);
        console.log(`      - Title: ${objectData.title}`);
        console.log(`      - Slug: ${objectData.slug}`);
        console.log(`      - Description: ${objectData.metadata.description ? "✅ Yes" : "❌ None"}`);
        console.log(`      - Image: ${hostInfo.image ? `✅ Would upload ${hostInfo.image.filename}` : "❌ None"}`);
        created++;
      }
    }

    console.log(`\n📊 Creation Summary:`);
    console.log(`   ✅ ${isDryRun ? "Would create" : "Created"}: ${created} hosts`);
    if (errors > 0) console.log(`   ❌ Errors: ${errors} hosts`);
    if (skipped > 0) console.log(`   ⏭️ Skipped: ${skipped} hosts`);
    console.log(`   📦 Total processed: ${hostData.length} hosts`);

    if (isDryRun) {
      console.log(`\n💡 This was a dry run. To actually create the objects, run with --live flag`);
    }
  } catch (error) {
    console.error("❌ Error creating Cosmic hosts:", error);
  }
}

async function main() {
  console.log("🎵 Starting host profile creation process...");

  // Check for dry run flag
  const isDryRun = process.argv.includes("--dry-run") || process.argv.includes("-d");
  const isLive = process.argv.includes("--live") || process.argv.includes("-l");

  if (!isDryRun && !isLive) {
    console.log("⚠️ No mode specified. Use --dry-run to preview or --live to actually create objects.");
    console.log("Running in dry-run mode by default...\n");
  }

  try {
    // Extract host data from episodes
    const hostData = await findHostDataFromEpisodes();

    if (hostData.length === 0) {
      console.log("❌ No host data found to create");
      return;
    }

    console.log(`\n📦 Found ${hostData.length} hosts with data`);

    // Show summary of what we found
    console.log("\n=== Host Data Summary ===");
    hostData.slice(0, 10).forEach((host, i) => {
      console.log(`${i + 1}. ${host.title} (${host.slug})`);

      console.log(`   Description: ${host.description ? "✅" : "❌"}`);
      console.log(`   Image: ${host.image ? "✅" : "❌"}`);
    });

    if (hostData.length > 10) {
      console.log(`   ... and ${hostData.length - 10} more hosts`);
    }

    // Create/preview in Cosmic
    await createCosmicHosts(hostData, !isLive);

    console.log("\n🎉 Host profile creation process completed!");

    if (!isLive) {
      console.log("\n💡 To actually create the objects in Cosmic, run:");
      console.log("   node scripts/create-host-profiles.js --live");
    }
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, findHostDataFromEpisodes, createCosmicHosts };
