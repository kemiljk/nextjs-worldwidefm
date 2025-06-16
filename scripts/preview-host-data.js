const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const mysql = require("mysql2/promise");

const config = {
  mysql: {
    host: "localhost",
    user: "root",
    database: "worldwidefm",
  },
};

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
      LIMIT 20
    `);

    console.log(`📦 Found ${collectionCategories.length} collection categories (showing first 20)`);

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
        LIMIT 5
      `,
        [fieldId, category.id]
      );

      if (episodeRelations.length > 0) {
        console.log(`   📻 Found ${episodeRelations.length} episodes for this collection`);

        // Get the first episode to extract host information
        const firstEpisode = episodeRelations[0];
        console.log(`   🎵 First episode: ${firstEpisode.episode_title}`);

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

          // Take first paragraph or first 200 characters
          const sentences = description.split(/[.!?]+/);
          if (sentences.length > 1) {
            description = sentences.slice(0, 2).join(". ").trim();
            if (!description.endsWith(".")) description += ".";
          } else if (description.length > 200) {
            description = description.substring(0, 200).trim() + "...";
          }

          if (description.length > 10) {
            console.log(`   📝 Extracted description: ${description}`);
          }
        } else if (firstEpisode.field_description) {
          description = firstEpisode.field_description;
          console.log(`   📝 Found description field: ${description}`);
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
          episodes: episodeRelations.map((ep) => ({
            title: ep.episode_title,
            slug: ep.episode_slug,
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

async function main() {
  console.log("🎵 Previewing host profile data extraction...");

  try {
    // Extract host data from episodes
    const hostData = await findHostDataFromEpisodes();

    if (hostData.length === 0) {
      console.log("❌ No host data found");
      return;
    }

    console.log(`\n📦 Found ${hostData.length} hosts with data`);

    // Show detailed summary of what we found
    console.log("\n=== Detailed Host Data Summary ===");
    hostData.forEach((host, i) => {
      console.log(`\n${i + 1}. 👤 ${host.title}`);
      console.log(`   🔗 Slug: ${host.slug}`);
      console.log(`   📻 Episodes: ${host.episodeCount}`);
      console.log(`   📝 Description: ${host.description ? "✅ Yes" : "❌ No"}`);
      console.log(`   🖼️  Image: ${host.image ? `✅ ${host.image.filename}` : "❌ No"}`);

      if (host.description) {
        console.log(`   📄 Description text: "${host.description}"`);
      }

      if (host.episodes.length > 0) {
        console.log(`   🎵 Recent episodes:`);
        host.episodes.slice(0, 3).forEach((ep, idx) => {
          console.log(`      ${idx + 1}. ${ep.title}`);
        });
      }
    });

    console.log("\n🎉 Preview completed!");
    console.log("\n💡 To update Cosmic hosts, make sure your .env file has:");
    console.log("   - NEXT_PUBLIC_COSMIC_BUCKET_SLUG");
    console.log("   - NEXT_PUBLIC_COSMIC_READ_KEY");
    console.log("   - COSMIC_WRITE_KEY");
    console.log("\n   Then run: node scripts/update-host-profiles.js");
  } catch (error) {
    console.error("❌ Error in preview process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, findHostDataFromEpisodes };
