require("dotenv").config();
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

async function examineHostData() {
  const connection = await getConnection();
  try {
    // First, let's look at Pedro Montenegro episode specifically
    console.log("\n=== Examining Pedro Montenegro Episode ===");

    const [pedroEpisodes] = await connection.execute(`
      SELECT 
        e.id,
        c.title,
        s.slug,
        c.*
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      JOIN craft_sections sec ON e.sectionId = sec.id
      WHERE c.title LIKE '%Pedro Montenegro%'
      AND sec.handle = 'episode'
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND s.siteId = 1
      LIMIT 1
    `);

    if (pedroEpisodes.length > 0) {
      const episode = pedroEpisodes[0];
      console.log(`📻 Episode: ${episode.title}`);
      console.log(`🔗 Slug: ${episode.slug}`);
      console.log(`🆔 ID: ${episode.id}`);

      // Get all content fields for this episode
      console.log("\n📋 Available content fields:");
      Object.keys(episode).forEach((key) => {
        if (key.startsWith("field_") && episode[key] !== null && episode[key] !== "") {
          console.log(`   ${key}: ${episode[key]}`);
        }
      });

      // Look for assets (images) related to this episode
      console.log("\n🖼️  Assets related to this episode:");
      const [assets] = await connection.execute(
        `
        SELECT 
          a.*,
          v.name as volume_name,
          v.handle as volume_handle,
          r.fieldId
        FROM craft_assets a
        JOIN craft_relations r ON a.id = r.targetId
        JOIN craft_volumes v ON a.volumeId = v.id
        WHERE r.sourceId = ?
      `,
        [episode.id]
      );

      assets.forEach((asset) => {
        console.log(`   📸 ${asset.filename} (Field ID: ${asset.fieldId})`);
        console.log(`      Volume: ${asset.volume_name} (${asset.volume_handle})`);
        console.log(`      Size: ${asset.size} bytes, Kind: ${asset.kind}`);
        console.log(`      Folder: ${asset.folderId || "root"}`);
      });

      // Look for matrix blocks (structured content)
      console.log("\n🧱 Matrix blocks for this episode:");
      const [blocks] = await connection.execute(
        `
        SELECT 
          mb.*,
          mc.*,
          mf.handle as fieldHandle
        FROM craft_matrixblocks mb
        JOIN craft_content mc ON mb.id = mc.elementId
        JOIN craft_fields mf ON mb.fieldId = mf.id
        WHERE mb.ownerId = ?
        ORDER BY mb.sortOrder
      `,
        [episode.id]
      );

      blocks.forEach((block) => {
        console.log(`   🔲 Block Type: ${block.type} (Field: ${block.fieldHandle})`);
        console.log(`      Sort Order: ${block.sortOrder}`);
        // Show non-null content fields
        Object.keys(block).forEach((key) => {
          if (key.startsWith("field_") && block[key] !== null && block[key] !== "") {
            console.log(`      ${key}: ${block[key]}`);
          }
        });
        console.log("");
      });
    }

    // Now let's examine the field structure of episodes
    console.log("\n=== Episode Field Structure ===");

    // Get the section ID for episodes
    const [episodeSection] = await connection.execute(`
      SELECT id FROM craft_sections WHERE handle = 'episode'
    `);

    if (episodeSection.length > 0) {
      const sectionId = episodeSection[0].id;

      // Get entry types for episodes
      const [entryTypes] = await connection.execute(
        `
        SELECT * FROM craft_entrytypes WHERE sectionId = ?
      `,
        [sectionId]
      );

      console.log(`📝 Entry types for episodes:`);
      entryTypes.forEach((type) => {
        console.log(`   - ${type.name} (${type.handle}), Layout ID: ${type.fieldLayoutId}`);
      });

      // Get fields for the first entry type
      if (entryTypes.length > 0) {
        const layoutId = entryTypes[0].fieldLayoutId;

        const [fields] = await connection.execute(
          `
          SELECT f.* 
          FROM craft_fields f 
          JOIN craft_fieldlayoutfields fl ON f.id = fl.fieldId 
          WHERE fl.layoutId = ?
          ORDER BY fl.sortOrder
        `,
          [layoutId]
        );

        console.log(`\n🔧 Fields available for episodes:`);
        fields.forEach((field) => {
          console.log(`   - ${field.name} (${field.handle}) - Type: ${field.type}`);
          if (field.settings) {
            try {
              const settings = JSON.parse(field.settings);
              if (settings.instructions) {
                console.log(`     Instructions: ${settings.instructions}`);
              }
            } catch (e) {}
          }
        });
      }
    }

    // Let's also look for any entries that might be host profiles
    console.log("\n=== Looking for Host Profile Data ===");

    // Check if there are any users or other tables that might contain host info
    const [tables] = await connection.execute(`
      SHOW TABLES
    `);

    console.log("📊 Tables that might contain host data:");
    tables.forEach((table) => {
      console.log(`   - ${Object.values(table)[0]}`);
    });

    // Look for categories that might represent hosts
    console.log("\n🏷️  Categories (potential hosts):");
    const [categories] = await connection.execute(`
      SELECT 
        c.*,
        cc.title,
        s.slug,
        cg.name as group_name,
        cg.handle as group_handle
      FROM craft_categories c
      JOIN craft_elements el ON c.id = el.id
      JOIN craft_content cc ON c.id = cc.elementId
      JOIN craft_elements_sites s ON c.id = s.elementId
      JOIN craft_categorygroups cg ON c.groupId = cg.id
      WHERE el.dateDeleted IS NULL
      AND s.siteId = 1
      ORDER BY cg.name, cc.title
      LIMIT 20
    `);

    categories.forEach((cat) => {
      console.log(`   [${cat.group_name}] ${cat.title} (${cat.slug})`);
    });

    // Let's specifically examine the episodeCollection field
    console.log("\n=== Examining Episode Collections ===");

    // Find episodes with Pedro Montenegro and examine their episodeCollection
    const [pedroWithCollection] = await connection.execute(`
      SELECT 
        e.id,
        c.title,
        s.slug,
        c.field_episodeCollection
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      JOIN craft_sections sec ON e.sectionId = sec.id
      WHERE c.title LIKE '%Pedro Montenegro%'
      AND sec.handle = 'episode'
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND s.siteId = 1
      LIMIT 3
    `);

    console.log("📦 Pedro Montenegro episodes with collection data:");
    for (const ep of pedroWithCollection) {
      console.log(`   ${ep.title} (${ep.slug})`);
      console.log(`   Collection field: ${ep.field_episodeCollection}`);

      // If there's a collection ID, let's find the category
      if (ep.field_episodeCollection) {
        const [collectionCat] = await connection.execute(
          `
          SELECT 
            c.*,
            cc.title,
            s.slug,
            cg.name as group_name
          FROM craft_categories c
          JOIN craft_content cc ON c.id = cc.elementId
          JOIN craft_elements_sites s ON c.id = s.elementId
          JOIN craft_categorygroups cg ON c.groupId = cg.id
          WHERE c.id = ?
        `,
          [ep.field_episodeCollection]
        );

        if (collectionCat.length > 0) {
          const cat = collectionCat[0];
          console.log(`   → Collection: [${cat.group_name}] ${cat.title} (${cat.slug})`);
        }
      }
      console.log("");
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  examineHostData().catch(console.error);
}

module.exports = { examineHostData };
