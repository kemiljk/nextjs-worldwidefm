const path = require('path');
// Load both .env files
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');
const { createBucketClient } = require('@cosmicjs/sdk');

// Check environment variables
console.log('Environment variables:');
console.log('COSMIC_BUCKET_SLUG:', process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
console.log('COSMIC_READ_KEY:', process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? 'Present' : 'Missing');
console.log('COSMIC_WRITE_KEY:', process.env.COSMIC_WRITE_KEY ? 'Present' : 'Missing');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'Present' : 'Missing');
console.log('DB_NAME:', process.env.DB_NAME);

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: '', // Use empty password as it worked before
  database: process.env.DB_NAME || 'worldwidefm',
  port: parseInt(process.env.DB_PORT || '3306', 10),
};

async function transformShow(show) {
  try {
    // Format the date
    let formattedDate = null;
    try {
      const date = new Date(show.dateCreated);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error(`Error formatting date for show ${show.title}:`, error);
    }

    // Create the show object with only the required fields
    const showObject = {
      type: 'radio-shows',
      title: show.title,
      slug: show.slug,
      metadata: {
        subtitle: '',
        description: show.description || '',
        page_link: '',
        source: '',
        broadcast_date: show.broadcastDate || formattedDate || '',
        broadcast_time: '',
        duration: '',
        categories: '',
        player: show.player || '',
        tracklist: show.tracklist || '',
        body_text: show.bodyText || '',
        image: show.thumbnail || ''
      }
    };

    return showObject;
  } catch (error) {
    console.error(`Error transforming show ${show.title}:`, error);
    throw error;
  }
}

async function uploadShow(bucket, show) {
  try {
    console.log(`Creating new show: ${show.title}`);
    const result = await bucket.objects.insertOne(show);
    console.log(`Successfully created show: ${show.title}`);
    return result;
  } catch (error) {
    console.error(`Error uploading show ${show.title}:`, error);
    throw error;
  }
}

async function createRadioShowObjectType(bucket) {
  try {
    // Check if object type already exists
    const objectTypes = await bucket.objectTypes.find();
    const existingType = objectTypes.object_types.find(type => type.slug === 'radio-shows');

    if (existingType) {
      console.log('Deleting existing radio-shows object type...');
      await bucket.objectTypes.deleteOne('radio-shows');
      console.log('Existing radio-shows object type deleted successfully');
    }

    console.log('Creating radio-shows object type...');
    await bucket.objectTypes.insertOne({
      title: 'Radio Shows',
      slug: 'radio-shows',
      metafields: [
        {
          title: 'Subtitle',
          key: 'subtitle',
          type: 'text',
          required: false
        },
        {
          title: 'Image',
          key: 'image',
          type: 'file',
          required: false
        },
        {
          title: 'Description',
          key: 'description',
          type: 'textarea',
          required: false
        },
        {
          title: 'Page Link',
          key: 'page_link',
          type: 'text',
          required: false
        },
        {
          title: 'Source',
          key: 'source',
          type: 'text',
          required: false
        },
        {
          title: 'Broadcast Date',
          key: 'broadcast_date',
          type: 'text',
          required: false
        },
        {
          title: 'Broadcast Time',
          key: 'broadcast_time',
          type: 'text',
          required: false
        },
        {
          title: 'Duration',
          key: 'duration',
          type: 'text',
          required: false
        },
        {
          title: 'Categories',
          key: 'categories',
          type: 'text',
          required: false
        },
        {
          title: 'Player',
          key: 'player',
          type: 'text',
          required: true
        },
        {
          title: 'Tracklist',
          key: 'tracklist',
          type: 'textarea',
          required: false
        },
        {
          title: 'Body Text',
          key: 'body_text',
          type: 'textarea',
          required: false
        }
      ]
    });
    console.log('Radio shows object type created successfully');
  } catch (error) {
    console.error('Error creating radio shows object type:', error);
    throw error;
  }
}

function calculateMetadataScore(show) {
  let score = 0;
  const metadata = show.metadata || {};

  // Check description
  if (metadata.description && metadata.description.length > 0) score += 3;

  // Check player (required field)
  if (metadata.player && metadata.player.length > 0) score += 3;

  // Check tracklist
  if (metadata.tracklist && metadata.tracklist.length > 0) score += 2;

  // Check body text
  if (metadata.body_text && metadata.body_text.length > 0) score += 2;

  // Check broadcast details
  if (metadata.broadcast_date) score += 2;
  if (metadata.broadcast_time) score += 2;
  if (metadata.duration) score += 2;

  // Check image
  if (metadata.image) score += 2;

  // Check other fields
  if (metadata.subtitle) score += 1;
  if (metadata.page_link) score += 1;
  if (metadata.source) score += 1;

  return score;
}

async function deduplicateShows(shows) {
  // Group shows by title
  const groupedShows = shows.reduce((acc, show) => {
    const title = show.title.toLowerCase().trim();
    if (!acc[title]) {
      acc[title] = [];
    }
    acc[title].push(show);
    return acc;
  }, {});

  // For each group, keep the show with the highest score
  const uniqueShows = Object.values(groupedShows).map(group => {
    return group.sort((a, b) => calculateMetadataScore(b) - calculateMetadataScore(a))[0];
  });

  console.log(`Deduplicated ${shows.length} shows to ${uniqueShows.length} unique shows`);
  return uniqueShows;
}

async function migrateRadioShows() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Connect to Cosmic
    const bucket = await createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    });

    // First create the radio shows object type
    console.log('Setting up radio shows object type...');
    await createRadioShowObjectType(bucket);

    // Get all radio shows from the editorial section
    const [shows] = await connection.execute(`
      SELECT 
        e.id,
        c.title,
        s.slug,
        c.field_description as description,
        c.field_player as player,
        c.field_tracklist as tracklist,
        c.field_bodyText as bodyText,
        c.field_broadcastDate as broadcastDate,
        e.dateCreated
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      JOIN craft_sections sec ON e.sectionId = sec.id
      WHERE sec.handle = 'editorial'
      AND e.typeId = (
        SELECT id FROM craft_entrytypes WHERE handle = 'editorial'
      )
      AND s.siteId = 1
      AND c.title IS NOT NULL
      ORDER BY e.dateCreated DESC
    `);

    console.log(`Found ${shows.length} radio shows to migrate`);

    // Transform all shows
    const transformedShows = await Promise.all(shows.map(show => transformShow(show)));

    // Deduplicate shows before uploading
    const uniqueShows = await deduplicateShows(transformedShows);

    // Upload each unique show
    for (const show of uniqueShows) {
      console.log(`Processing show: ${show.title}`);
      try {
        await uploadShow(bucket, show);
      } catch (error) {
        console.error(`Failed to process show ${show.title}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
  console.log('Migration completed');
}

if (require.main === module) {
  migrateRadioShows();
} 