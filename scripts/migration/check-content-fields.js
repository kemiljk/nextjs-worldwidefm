require('dotenv').config();
const mysql = require('mysql2/promise');
const config = require('./config');

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function checkContentFields() {
  const connection = await getConnection();
  try {
    // Get the editorial section ID
    const [editorialSection] = await connection.execute(`
      SELECT id FROM craft_sections WHERE handle = 'editorial'
    `);

    if (editorialSection.length === 0) {
      console.log('No editorial section found');
      return;
    }

    const sectionId = editorialSection[0].id;
    console.log('\nEditorial Section ID:', sectionId);

    // First check the matrix block types
    const [blockTypes] = await connection.execute(`
      SELECT * FROM craft_matrixblocktypes
      WHERE fieldId = 10
    `);

    console.log('\nMatrix Block Types:');
    console.log(JSON.stringify(blockTypes, null, 2));

    // Now let's look at entries in this section with their matrix content
    const [entries] = await connection.execute(`
      SELECT 
        e.id,
        e.dateCreated,
        c.title,
        c.field_description,
        mbt.handle as block_type,
        mfc.*
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      LEFT JOIN craft_matrixblocks mb ON e.id = mb.ownerId
      LEFT JOIN craft_matrixblocktypes mbt ON mb.typeId = mbt.id
      LEFT JOIN craft_matrixcontent_flexiblecontent mfc ON mb.id = mfc.elementId
      WHERE e.sectionId = ?
      AND mbt.handle = 'bodyText'
      LIMIT 5
    `, [sectionId]);

    console.log('\nSample Entries with Matrix Content:');
    console.log(JSON.stringify(entries, null, 2));

    // Let's also check the matrix content table structure
    const [matrixFields] = await connection.execute(`
      DESCRIBE craft_matrixcontent_flexiblecontent
    `);
    console.log('\nMatrix Content Table Structure:');
    console.log(JSON.stringify(matrixFields, null, 2));

  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  checkContentFields();
} 