const { createBucketClient } = require('@cosmicjs/sdk');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: config.cosmic.bucketSlug,
  readKey: config.cosmic.readKey,
  writeKey: config.cosmic.writeKey
});

// Initialize MySQL connection
async function getConnection() {
  return mysql.createConnection({
    host: config.craft.dbHost,
    user: config.craft.dbUser,
    password: config.craft.dbPassword,
    database: config.craft.dbName,
    port: config.craft.dbPort
  });
}

// Extract content types from Craft
async function extractContentTypes() {
  const connection = await getConnection();
  try {
    // Get all field layouts
    const [fieldLayouts] = await connection.execute(
      'SELECT * FROM fieldlayouts'
    );

    // Get all fields
    const [fields] = await connection.execute(
      'SELECT * FROM fields'
    );

    // Get all entries
    const [entries] = await connection.execute(
      'SELECT * FROM entries'
    );

    // Save to output directory
    await fs.mkdir(path.join(config.paths.outputDir, 'raw'), { recursive: true });
    await fs.writeFile(
      path.join(config.paths.outputDir, 'raw', 'schema.json'),
      JSON.stringify({ fieldLayouts, fields, entries }, null, 2)
    );

    return { fieldLayouts, fields, entries };
  } finally {
    await connection.end();
  }
}

// Transform Craft data to Cosmic format
async function transformData(craftData) {
  // Map content types
  const objectTypes = craftData.fieldLayouts.map(layout => ({
    title: layout.type,
    singular: layout.type,
    // We'll expand this mapping based on actual data structure
    metafields: []
  }));

  await fs.mkdir(path.join(config.paths.outputDir, 'transformed'), { recursive: true });
  await fs.writeFile(
    path.join(config.paths.outputDir, 'transformed', 'object-types.json'),
    JSON.stringify(objectTypes, null, 2)
  );

  return objectTypes;
}

// Upload to Cosmic
async function uploadToCosmic(transformedData) {
  for (const objectType of transformedData) {
    try {
      await cosmic.objectTypes.insertOne(objectType);
      console.log(`Created object type: ${objectType.title}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`Object type ${objectType.title} already exists, updating...`);
        await cosmic.objectTypes.updateOne(objectType.slug, objectType);
      } else {
        console.error(`Error creating object type ${objectType.title}:`, error);
      }
    }
  }
}

// Main migration function
async function migrate() {
  try {
    console.log('Starting migration...');

    // Extract data from Craft
    console.log('Extracting data from Craft...');
    const craftData = await extractContentTypes();

    // Transform data
    console.log('Transforming data...');
    const transformedData = await transformData(craftData);

    // Upload to Cosmic
    console.log('Uploading to Cosmic...');
    await uploadToCosmic(transformedData);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate();
} 