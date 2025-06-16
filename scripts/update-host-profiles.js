require("dotenv").config();
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");

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
const cosmic = createBucketClient(config.cosmic);

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
          c.field_description
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
      `,
        [fieldId, category.id]
      );

      if (episodeRelations.length > 0) {
        console.log(`   📻 Found ${episodeRelations.length} episodes for this collection`);

        // Get the first episode to extract host information
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
            .trim();

          // Take first paragraph or first 200 characters
          const sentences = description.split(/[.!?]+/);
          if (sentences.length > 1) {
            description = sentences.slice(0, 2).join(". ").trim();
            if (!description.endsWith(".")) description += ".";
          } else if (description.length > 200) {
            description = description.substring(0, 200).trim() + "...";
          }

          console.log(`   📝 Extracted description: ${description.substring(0, 100)}...`);
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

async function updateCosmicHosts(hostData) {
  console.log("\n=== Updating Cosmic Regular Hosts ===");

  try {
    // Get existing regular hosts from Cosmic
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
        status: "published",
      })
      .props("id,slug,title,metadata");

    const existingHosts = response.objects || [];
    console.log(`📊 Found ${existingHosts.length} existing hosts in Cosmic`);

    let updated = 0;
    let notFound = 0;

    for (const hostInfo of hostData) {
      // Find matching host in Cosmic by slug
      const existingHost = existingHosts.find((h) => h.slug === hostInfo.slug);

      if (existingHost) {
        console.log(`\n🔄 Updating: ${existingHost.title} (${existingHost.slug})`);

        // Prepare update data
        const updateData = {
          title: existingHost.title, // Keep existing title
          content: hostInfo.description || "",
          metadata: {
            description: hostInfo.description || existingHost.metadata?.description || null,
            image: hostInfo.image || existingHost.metadata?.image || null,
            episode_count: hostInfo.episodeCount || 0,
            first_episode_slug: hostInfo.firstEpisodeSlug || null,
          },
        };

        // Log what we're updating
        if (hostInfo.description) {
          console.log(`   📝 Adding description: ${hostInfo.description.substring(0, 80)}...`);
        }
        if (hostInfo.image) {
          console.log(`   🖼️ Adding image: ${hostInfo.image.filename}`);
        }
        console.log(`   📻 Episode count: ${hostInfo.episodeCount}`);

        // Update in Cosmic
        try {
          await cosmic.objects.insertOne({
            id: existingHost.id,
            ...updateData,
          });

          updated++;
          console.log(`   ✅ Successfully updated ${existingHost.title}`);
        } catch (error) {
          console.error(`   ❌ Error updating ${existingHost.title}:`, error.message);
        }
      } else {
        console.log(`⚠️ No matching host found in Cosmic for: ${hostInfo.title} (${hostInfo.slug})`);
        notFound++;
      }
    }

    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ Updated: ${updated} hosts`);
    console.log(`   ⚠️ Not found in Cosmic: ${notFound} hosts`);
    console.log(`   📦 Total processed: ${hostData.length} hosts`);
  } catch (error) {
    console.error("❌ Error updating Cosmic hosts:", error);
  }
}

async function main() {
  console.log("🎵 Starting host profile update process...");

  try {
    // Extract host data from episodes
    const hostData = await findHostDataFromEpisodes();

    if (hostData.length === 0) {
      console.log("❌ No host data found to update");
      return;
    }

    console.log(`\n📦 Found ${hostData.length} hosts with data`);

    // Show summary of what we found
    console.log("\n=== Host Data Summary ===");
    hostData.slice(0, 10).forEach((host, i) => {
      console.log(`${i + 1}. ${host.title} (${host.slug})`);
      console.log(`   Episodes: ${host.episodeCount}`);
      console.log(`   Description: ${host.description ? "✅" : "❌"}`);
      console.log(`   Image: ${host.image ? "✅" : "❌"}`);
    });

    if (hostData.length > 10) {
      console.log(`   ... and ${hostData.length - 10} more hosts`);
    }

    // Update Cosmic
    await updateCosmicHosts(hostData);

    console.log("\n🎉 Host profile update process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, findHostDataFromEpisodes, updateCosmicHosts };
