const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');
const { createBucketClient } = require('@cosmicjs/sdk');

// Configuration
const config = {
  mysql: {
    host: 'localhost',
    user: 'root',
    database: 'worldwidefm',
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  }
};

// Validate Cosmic configuration
if (!config.cosmic.bucketSlug || !config.cosmic.writeKey) {
  console.error('Missing required Cosmic configuration:');
  if (!config.cosmic.bucketSlug) console.error('- NEXT_PUBLIC_COSMIC_BUCKET_SLUG is not set');
  if (!config.cosmic.writeKey) console.error('- COSMIC_WRITE_KEY is not set');
  process.exit(1);
}

// Global settings
const isDryRun = process.env.DRY_RUN === 'true';

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: config.cosmic.bucketSlug,
  readKey: config.cosmic.readKey,
  writeKey: config.cosmic.writeKey
});

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function getSection(sectionHandle) {
  const connection = await getConnection();
  try {
    const [sections] = await connection.execute(
      'SELECT * FROM craft_sections WHERE handle = ?',
      [sectionHandle]
    );
    return sections[0];
  } finally {
    await connection.end();
  }
}

async function getEntries(sectionId) {
  const connection = await getConnection();
  try {
    // Get entries with their content and relations
    const [entries] = await connection.execute(`
      SELECT 
        e.*,
        c.*,
        GROUP_CONCAT(DISTINCT r.fieldId, ':', r.targetId) as relations,
        s.slug as entry_slug
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId
      LEFT JOIN craft_elements_sites s ON e.id = s.elementId
      WHERE e.sectionId = ? 
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      GROUP BY e.id
    `, [sectionId]);

    // For each entry, get its matrix blocks if any exist
    for (const entry of entries) {
      const [blocks] = await connection.execute(`
        SELECT 
          mb.*,
          mc.*,
          mf.handle as fieldHandle
        FROM craft_matrixblocks mb
        JOIN craft_content mc ON mb.id = mc.elementId
        JOIN craft_fields mf ON mb.fieldId = mf.id
        WHERE mb.ownerId = ?
        ORDER BY mb.sortOrder
      `, [entry.id]);

      entry.matrixBlocks = blocks;
    }

    return entries;
  } finally {
    await connection.end();
  }
}

async function getFields(layoutId) {
  const connection = await getConnection();
  try {
    const [fields] = await connection.execute(`
      SELECT f.* 
      FROM craft_fields f 
      JOIN craft_fieldlayoutfields fl ON f.id = fl.fieldId 
      WHERE fl.layoutId = ?
    `, [layoutId]);
    return fields;
  } finally {
    await connection.end();
  }
}

async function getEntryTypes(sectionId) {
  const connection = await getConnection();
  try {
    const [types] = await connection.execute(
      'SELECT * FROM craft_entrytypes WHERE sectionId = ?',
      [sectionId]
    );
    return types;
  } finally {
    await connection.end();
  }
}

async function getFieldValue(connection, field, entry, contentColumn) {
  try {
    // Handle different field types
    switch (field.type) {
      case 'craft\\fields\\Assets': {
        // Get asset data
        const [assets] = await connection.execute(`
          SELECT a.*, v.filename, v.title, v.url
          FROM craft_assets a
          JOIN craft_elements el ON a.id = el.id
          JOIN craft_volumes v ON a.volumeId = v.id
          JOIN craft_relations r ON a.id = r.targetId
          WHERE r.sourceId = ? AND r.fieldId = ?
          AND el.dateDeleted IS NULL
        `, [entry.id, field.id]);

        if (assets.length === 0) return null;

        // For thumbnail field, return image object
        if (field.handle === 'thumbnail') {
          return {
            url: assets[0].url,
            imgix_url: assets[0].url,
            title: assets[0].title,
            filename: assets[0].filename
          };
        }

        // For other asset fields, return array of assets
        return assets.map(asset => ({
          url: asset.url,
          imgix_url: asset.url,
          title: asset.title,
          filename: asset.filename
        }));
      }

      case 'craft\\fields\\Matrix': {
        // Get matrix blocks for this field
        const blocks = entry.matrixBlocks?.filter(block => block.fieldId === field.id) || [];
        return blocks.map(block => ({
          type: block.type,
          fields: {
            ...block
          }
        }));
      }

      case 'craft\\fields\\Categories': {
        if (!entry.relations) return [];
        const categoryRelations = entry.relations.split(',')
          .filter(r => r.split(':')[0] === field.id.toString())
          .map(r => r.split(':')[1])
          .filter(Boolean);

        if (categoryRelations.length === 0) return [];

        const [categories] = await connection.execute(`
          SELECT c.*, cc.title, s.slug
          FROM craft_categories c
          JOIN craft_elements el ON c.id = el.id
          JOIN craft_content cc ON c.id = cc.elementId
          JOIN craft_elements_sites s ON c.id = s.elementId
          WHERE c.id IN (?)
          AND el.dateDeleted IS NULL
          AND s.siteId = 1
        `, [categoryRelations]);

        // For genreTags field, return array of category objects
        return categories.map(cat => ({
          id: cat.id,
          title: cat.title,
          slug: cat.slug
        }));
      }

      case 'craft\\fields\\Entries': {
        if (!entry.relations) return [];
        const entryRelations = entry.relations.split(',')
          .filter(r => r.split(':')[0] === field.id.toString())
          .map(r => r.split(':')[1])
          .filter(Boolean);

        if (entryRelations.length === 0) return [];

        const [relatedEntries] = await connection.execute(`
          SELECT e.*, c.title, s.slug
          FROM craft_entries e
          JOIN craft_elements el ON e.id = el.id
          JOIN craft_content c ON e.id = c.elementId
          JOIN craft_elements_sites s ON e.id = s.elementId
          WHERE e.id IN (?)
          AND el.dateDeleted IS NULL
          AND s.siteId = 1
        `, [entryRelations]);

        // For episodeCollection field, return array of episode objects
        return relatedEntries.map(e => ({
          id: e.id,
          title: e.title,
          slug: e.slug
        }));
      }

      case 'craft\\fields\\Date': {
        if (!entry[contentColumn]) return null;

        const date = new Date(entry[contentColumn]);
        if (isNaN(date.getTime())) {
          console.log(`Invalid date for ${field.handle}:`, entry[contentColumn]);
          return null;
        }

        // For broadcast dates, return just the date part
        if (field.handle === 'broadcastDate') {
          return date.toISOString().split('T')[0];
        }

        // For broadcast times, return just the time part
        if (field.handle === 'broadcastTime') {
          return date.toISOString().split('T')[1].substring(0, 5);
        }

        // For other date fields, return just the date part
        return date.toISOString().split('T')[0];
      }

      case 'craft\\fields\\Lightswitch':
        return entry[contentColumn] === '1' ? 'true' : 'false';

      case 'craft\\fields\\Number':
        // Special handling for duration fields
        if (field.handle.includes('duration')) {
          const minutes = parseInt(entry[contentColumn]);
          return minutes ? `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}` : null;
        }
        return entry[contentColumn] ? parseFloat(entry[contentColumn]) : null;

      case 'craft\\fields\\Dropdown':
        // Return the selected value as is
        return entry[contentColumn] || null;

      case 'craft\\redactor\\Field':
      case 'craft\\fields\\RichText': {
        // For tracklist and bodyText fields, return HTML content
        const content = entry[contentColumn];
        if (!content) return null;

        // Clean up any potential invalid characters or encoding issues
        return content.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '');
      }

      case 'craft\\fields\\Table':
        // Parse table data if it exists
        try {
          return entry[contentColumn] ? JSON.parse(entry[contentColumn]) : [];
        } catch (e) {
          console.error(`Error parsing table data for field ${field.handle}:`, e);
          return [];
        }

      case 'craft\\fields\\Url':
        return entry[contentColumn] || null;

      case 'craft\\fields\\PlainText': {
        // For description field, return text content
        const content = entry[contentColumn];
        if (!content) return null;

        // Clean up any potential invalid characters
        return content.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '');
      }

      default:
        // For any unhandled types, log it for debugging
        console.log(`Unhandled field type: ${field.type} for field: ${field.handle}`);
        return entry[contentColumn] || null;
    }
  } catch (error) {
    console.error(`Error getting field value for ${field.handle}:`, error);
    return null;
  }
}

async function migrateSection(connection, section) {
  console.log(`\nMigrating section: ${section.handle}`);

  // Get all entries for this section with proper slug from elements_sites
  const [entries] = await connection.execute(`
    SELECT DISTINCT
      e.*,
      c.*,
      s.slug,
      GROUP_CONCAT(DISTINCT CONCAT(r.fieldId, ':', r.targetId)) as relations,
      GROUP_CONCAT(DISTINCT mb.id) as matrixBlockIds
    FROM craft_entries e
    JOIN craft_elements el ON e.id = el.id
    JOIN craft_content c ON e.id = c.elementId
    JOIN craft_elements_sites s ON e.id = s.elementId
    LEFT JOIN craft_relations r ON e.id = r.sourceId
    LEFT JOIN craft_matrixblocks mb ON e.id = mb.ownerId
    WHERE e.sectionId = ?
    AND el.dateDeleted IS NULL
    AND s.siteId = 1
    AND e.id IN (
      SELECT MAX(e2.id)
      FROM craft_entries e2
      JOIN craft_elements_sites s2 ON e2.id = s2.elementId
      WHERE e2.sectionId = ?
      AND s2.siteId = 1
      GROUP BY s2.slug
    )
    GROUP BY e.id
  `, [section.id, section.id]);

  console.log(`Found ${entries.length} entries to migrate`);

  // Get matrix blocks if any exist
  const matrixBlockIds = entries
    .map(e => e.matrixBlockIds)
    .filter(Boolean)
    .join(',')
    .split(',')
    .filter(Boolean);

  let matrixBlocks = [];
  if (matrixBlockIds.length > 0) {
    const [blocks] = await connection.execute(`
      SELECT mb.*, c.*, f.handle as fieldHandle, t.handle as typeHandle
      FROM craft_matrixblocks mb
      JOIN craft_content c ON mb.id = c.elementId
      JOIN craft_fields f ON mb.fieldId = f.id
      JOIN craft_matrixblocktypes t ON mb.typeId = t.id
      WHERE mb.id IN (?)
    `, [matrixBlockIds]);
    matrixBlocks = blocks;
  }

  // Get all fields for this section
  const [fields] = await connection.execute(`
    SELECT f.* 
    FROM craft_fields f
    JOIN craft_fieldlayoutfields lf ON f.id = lf.fieldId
    JOIN craft_fieldlayouts l ON lf.layoutId = l.id
    JOIN craft_entrytypes et ON l.id = et.fieldLayoutId
    WHERE et.sectionId = ?
  `, [section.id]);

  console.log(`Found ${fields.length} fields to process`);

  for (const entry of entries) {
    try {
      if (!entry.slug) {
        console.log(`Skipping entry ${entry.id} - no slug found`);
        continue;
      }

      // Attach matrix blocks to entry
      entry.matrixBlocks = matrixBlocks.filter(block => block.ownerId === entry.id);

      // Build metadata object
      const metadata = {};
      for (const field of fields) {
        const contentColumn = `field_${field.handle}`;
        const value = await getFieldValue(connection, field, entry, contentColumn);
        if (value !== null) {
          metadata[field.handle] = value;
        }
      }

      // Create object in Cosmic
      const objectData = {
        title: entry.title,
        type: section.handle,
        slug: entry.slug,
        status: entry.enabled ? 'published' : 'draft',
        metadata
      };

      if (isDryRun) {
        console.log(`Would create object:`, JSON.stringify(objectData, null, 2));
        continue;
      }

      try {
        // Check if object already exists
        let existingObject = null;
        try {
          existingObject = await cosmic.objects.findOne({
            type: section.handle,
            slug: entry.slug
          });
        } catch (error) {
          // If the error is "No objects found", that's fine - we'll create a new one
          if (!error.message?.includes('No objects found')) {
            console.error(`Error checking for existing object ${entry.slug}:`, error);
            if (error.response?.data) {
              console.error('Response data:', error.response.data);
            }
            continue;
          }
        }

        if (existingObject) {
          console.log(`Updating existing object: ${entry.slug} (${entry.title})`);
          try {
            const response = await cosmic.objects.updateOne({
              id: existingObject.id,
              ...objectData
            });
            console.log(`Successfully updated: ${entry.slug}`);
          } catch (error) {
            console.error(`Error updating object ${entry.slug}:`, error);
            if (error.response?.data) {
              console.error('Response data:', error.response.data);
            }
            console.error('Object data:', JSON.stringify(objectData, null, 2));
          }
        } else {
          console.log(`Creating new object: ${entry.slug} (${entry.title})`);
          try {
            const response = await cosmic.objects.insertOne(objectData);
            console.log(`Successfully created: ${entry.slug}`);
          } catch (error) {
            console.error(`Error creating object ${entry.slug}:`, error);
            if (error.response?.data) {
              console.error('Response data:', error.response.data);
            }
            console.error('Object data:', JSON.stringify(objectData, null, 2));
          }
        }
      } catch (error) {
        console.error(`Error processing object ${entry.slug}:`, error);
        if (error.response?.data) {
          console.error('Response data:', error.response.data);
        }
        console.error('Object data:', JSON.stringify(objectData, null, 2));
        continue;
      }
    } catch (error) {
      console.error(`Error migrating entry ${entry.id}:`, error.message || error);
      continue;
    }
  }
}

async function main() {
  const sectionHandle = process.env.SECTION;
  if (!sectionHandle) {
    console.error('Please specify a section to migrate using SECTION environment variable');
    process.exit(1);
  }

  console.log(`Starting migration in ${isDryRun ? 'DRY RUN' : 'LIVE'} mode...`);

  try {
    // Create database connection
    const connection = await mysql.createConnection({
      host: config.mysql.host,
      user: config.mysql.user,
      database: config.mysql.database
    });

    // Get section info - simplified query that doesn't rely on craft_sections_entrytypes
    const [sections] = await connection.execute(`
      SELECT s.*, t.handle as typeHandle
      FROM craft_sections s
      JOIN craft_entrytypes t ON s.id = t.sectionId
      WHERE s.handle = ?
    `, [sectionHandle]);

    if (sections.length === 0) {
      console.error(`Section ${sectionHandle} not found`);
      process.exit(1);
    }

    const section = sections[0];
    await migrateSection(connection, section);

    await connection.end();
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
main(); 