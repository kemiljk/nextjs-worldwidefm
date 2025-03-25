const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createBucketClient } = require('@cosmicjs/sdk');

async function testCosmicConnection() {
  try {
    console.log('Testing Cosmic connection...');
    console.log('Config:', {
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY?.slice(0, 5) + '...',
      writeKey: process.env.COSMIC_WRITE_KEY?.slice(0, 5) + '...'
    });

    const cosmic = createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    });

    // Try to get object types first
    console.log('\nFetching object types...');
    const types = await cosmic.objectTypes.find();
    console.log('Object types:', types);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testCosmicConnection(); 