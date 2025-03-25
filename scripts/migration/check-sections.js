require('dotenv').config();
const mysql = require('mysql2/promise');
const config = require('./config');

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function checkSections() {
  const connection = await getConnection();
  try {
    // Get all sections
    const [sections] = await connection.execute('SELECT * FROM craft_sections');
    console.log('\nAvailable sections:');

    for (const section of sections) {
      console.log(`\nSection: ${section.name} (${section.handle})`);

      // First, get a sample entry to see what fields are available
      const [sampleEntry] = await connection.execute(`
        SELECT e.id
        FROM craft_entries e
        JOIN craft_elements_sites s ON e.id = s.elementId
        WHERE e.sectionId = ?
        AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
        AND s.siteId = 1
        LIMIT 1
      `, [section.id]);

      if (sampleEntry.length === 0) {
        console.log('No entries found in this section');
        continue;
      }

      // Get the column names from the content table for this entry
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'craft_content'
        AND COLUMN_NAME LIKE 'field_%'
      `);

      console.log('Available fields:');
      columns.forEach(col => {
        console.log(`- ${col.COLUMN_NAME}`);
      });

      // Get entries for this section with just the basic fields
      const [entries] = await connection.execute(`
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
      `, [section.id]);

      console.log(`\nFound ${entries.length} entries`);

      // Print first few entries as examples
      entries.slice(0, 3).forEach(entry => {
        console.log(`- ${entry.title} (${entry.slug})`);
      });
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  checkSections();
} 