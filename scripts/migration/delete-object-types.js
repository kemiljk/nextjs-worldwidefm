require('dotenv').config({ path: __dirname + '/.env' });
const { createBucketClient } = require('@cosmicjs/sdk');

const config = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: config.bucketSlug,
  readKey: config.readKey,
  writeKey: config.writeKey
});

const objectTypesToDelete = [
  'offers',
  'premiumContent',
  'worldwideAwards',
  'subscriptions'
];

async function deleteObjectTypes() {
  console.log('Starting deletion of unused object types...');

  for (const type of objectTypesToDelete) {
    try {
      console.log(`Deleting object type: ${type}`);
      await cosmic.objectTypes.deleteOne(type);
      console.log(`Successfully deleted object type: ${type}`);
    } catch (error) {
      if (error.message?.includes('not found')) {
        console.log(`Object type ${type} does not exist - skipping`);
      } else {
        console.error(`Error deleting object type ${type}:`, error.message || error);
      }
    }
  }

  console.log('\nDeletion completed!');
}

// Run deletion
deleteObjectTypes(); 