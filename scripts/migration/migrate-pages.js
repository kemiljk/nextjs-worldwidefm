require('dotenv').config();
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

// Global settings
const isDryRun = process.env.DRY_RUN === 'true';

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

// Define the pages to migrate
const pageSections = [
  'about',
  'subscriptions',
  'homepage',
  'schedule',
  'scheduleDay',
  'offers',
  'cookies',
  'privacy',
  'terms',
  'register',
  'worldwideAwards',
  'studiomonkeyshoulder'
];

async function migratePages() {
  try {
    console.log(`Starting page migration in ${isDryRun ? 'DRY RUN' : 'LIVE'} mode...`);

    for (const pageHandle of pageSections) {
      console.log(`\nProcessing page: ${pageHandle}`);

      try {
        // Use the existing migrate-content.js functionality
        process.env.SECTION = pageHandle;
        await require('./migrate-content.js');
      } catch (error) {
        console.error(`Error migrating ${pageHandle}:`, error);
        // Continue with next page even if one fails
        continue;
      }
    }

    console.log('\nPage migration completed!');
  } catch (error) {
    console.error('Page migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePages(); 