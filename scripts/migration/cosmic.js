const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createBucketClient } = require('@cosmicjs/sdk');

// Configuration
const config = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

// Validate configuration
if (!config.bucketSlug || !config.writeKey) {
  console.error('Missing required Cosmic configuration:');
  if (!config.bucketSlug) console.error('- NEXT_PUBLIC_COSMIC_BUCKET_SLUG is not set');
  if (!config.writeKey) console.error('- COSMIC_WRITE_KEY is not set');
  process.exit(1);
}

// Initialize Cosmic client
module.exports = createBucketClient({
  bucketSlug: config.bucketSlug,
  readKey: config.readKey,
  writeKey: config.writeKey
}); 