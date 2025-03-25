require('dotenv').config();
const mysql = require('mysql2/promise');
const config = require('./config');

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function checkEditorialFields() {
  const connection = await getConnection();
  try {
    // First, let's check what the relation field IDs mean
    console.log('\nChecking Field IDs:');
    const [fields] = await connection.execute(`
      SELECT id, name, handle, type
      FROM craft_fields
      WHERE id IN (4, 95)
    `);
    console.log('Fields:', fields);

    // Get multiple editorial entries with their fields
    const [entries] = await connection.execute(`
      SELECT 
        e.*,
        c.*,
        s.slug,
        GROUP_CONCAT(DISTINCT r.fieldId, ':', r.targetId, ':', r.sourceId) as relations
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId
      WHERE e.sectionId = (
        SELECT id FROM craft_sections WHERE handle = 'editorial'
      )
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND s.siteId = 1
      GROUP BY e.id
      ORDER BY e.dateCreated DESC
      LIMIT 5
    `);

    if (entries.length === 0) {
      console.log('No editorial entries found');
      return;
    }

    // Log each entry's fields
    for (const entry of entries) {
      console.log(`\nEntry: ${entry.title}`);
      console.log('=======================');

      // Log non-null fields that start with 'field_'
      Object.keys(entry).forEach(key => {
        if (key.startsWith('field_') && entry[key] !== null) {
          console.log(`${key}: ${entry[key]}`);
        }
      });

      // Log other important fields
      console.log('\nOther Important Fields:');
      console.log('id:', entry.id);
      console.log('slug:', entry.slug);
      console.log('dateCreated:', entry.dateCreated);
      console.log('relations:', entry.relations);

      // Get related assets
      if (entry.relations) {
        const relationParts = entry.relations.split(',');
        console.log('\nRelated Assets:');

        for (const relation of relationParts) {
          const [fieldId, targetId, sourceId] = relation.split(':');
          console.log(`\nChecking relation - Field: ${fieldId}, Target: ${targetId}, Source: ${sourceId}`);

          // Get the asset
          const [assets] = await connection.execute(`
            SELECT a.*, v.url as volumeUrl
            FROM craft_assets a
            JOIN craft_volumes v ON a.volumeId = v.id
            WHERE a.id = ?
          `, [targetId]);

          if (assets.length > 0) {
            const asset = assets[0];
            console.log('Asset Details:');
            console.log('Filename:', asset.filename);
            console.log('Volume URL:', asset.volumeUrl);
            console.log('Full URL:', `${asset.volumeUrl}/${asset.filename}`);
            console.log('Kind:', asset.kind);
            console.log('Size:', asset.size);
            console.log('Width:', asset.width);
            console.log('Height:', asset.height);
          } else {
            console.log('No asset found for ID:', targetId);
          }
        }
      }

      console.log('=======================\n');
    }

  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  checkEditorialFields();
} 