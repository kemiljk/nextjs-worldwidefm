require("dotenv").config();
const mysql = require("mysql2/promise");

// Simple database config
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

async function checkSections() {
  const connection = await getConnection();
  try {
    // Get all sections
    const [sections] = await connection.execute("SELECT * FROM craft_sections");
    console.log("\n=== Available sections ===");

    for (const section of sections) {
      console.log(`\n📁 Section: ${section.name} (handle: ${section.handle})`);
      console.log(`   ID: ${section.id}, Type: ${section.type}`);

      // Get entries for this section
      const [entries] = await connection.execute(
        `
        SELECT 
          e.id,
          c.title,
          s.slug
        FROM craft_entries e
        JOIN craft_content c ON e.id = c.elementId
        JOIN craft_elements_sites s ON e.id = s.elementId
        WHERE e.sectionId = ?
        AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
        AND s.siteId = 1
        ORDER BY e.dateCreated DESC
        LIMIT 10
      `,
        [section.id]
      );

      console.log(`   📊 ${entries.length > 0 ? `Found ${entries.length} entries (showing first 10):` : "No entries found"}`);

      // Print first few entries as examples
      entries.slice(0, 5).forEach((entry, i) => {
        console.log(`      ${i + 1}. ${entry.title} (${entry.slug})`);
      });
    }

    // Now let's specifically look for collection-related content
    console.log("\n=== Looking for collection-related entries ===");

    // Search for entries with 'collection' in the title or slug
    const [collectionEntries] = await connection.execute(`
      SELECT 
        e.id,
        c.title,
        s.slug,
        sec.name as section_name,
        sec.handle as section_handle
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      JOIN craft_sections sec ON e.sectionId = sec.id
      WHERE (c.title LIKE '%collection%' OR s.slug LIKE '%collection%')
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND s.siteId = 1
      ORDER BY e.dateCreated DESC
      LIMIT 20
    `);

    if (collectionEntries.length > 0) {
      console.log(`🔍 Found ${collectionEntries.length} entries with 'collection' in title or slug:`);
      collectionEntries.forEach((entry, i) => {
        console.log(`   ${i + 1}. [${entry.section_name}] ${entry.title} (${entry.slug})`);
      });
    } else {
      console.log('❌ No entries found with "collection" in title or slug');
    }

    // Let's also check for entries that might be artist/host profiles
    console.log("\n=== Looking for potential artist/host profiles ===");

    const [hostEntries] = await connection.execute(`
      SELECT 
        e.id,
        c.title,
        s.slug,
        sec.name as section_name,
        sec.handle as section_handle
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      JOIN craft_sections sec ON e.sectionId = sec.id
      WHERE (sec.handle LIKE '%host%' OR sec.handle LIKE '%artist%' OR sec.handle LIKE '%people%' OR sec.handle LIKE '%person%' OR sec.handle LIKE '%collection%')
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND s.siteId = 1
      ORDER BY e.dateCreated DESC
      LIMIT 20
    `);

    if (hostEntries.length > 0) {
      console.log(`👤 Found ${hostEntries.length} entries in potential host/artist sections:`);
      hostEntries.forEach((entry, i) => {
        console.log(`   ${i + 1}. [${entry.section_name}] ${entry.title} (${entry.slug})`);
      });
    } else {
      console.log("❌ No potential host/artist entries found");
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  checkSections().catch(console.error);
}

module.exports = { checkSections };
