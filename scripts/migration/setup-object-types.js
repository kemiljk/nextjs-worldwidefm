const path = require('path');
// Look for .env in the root directory
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createBucketClient } = require('@cosmicjs/sdk');

// Validate environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_COSMIC_BUCKET_SLUG',
  'NEXT_PUBLIC_COSMIC_READ_KEY',
  'COSMIC_WRITE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const COSMIC_CONFIG = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY
};

// Initialize Cosmic client
const cosmic = createBucketClient(COSMIC_CONFIG);

async function setupObjectTypes() {
  try {
    console.log('Setting up object types...');

    // Define object types
    const objectTypes = [
      {
        title: 'Genres',
        slug: 'genres',
        singular: 'Genre',
        options: {
          slug_field: true
        },
        metafields: [
          {
            title: 'Description',
            key: 'description',
            type: 'text',
            value: '',
            config: {
              required: false
            }
          },
          {
            title: 'Image',
            key: 'image',
            type: 'file',
            value: '',
            config: {
              required: false
            }
          }
        ]
      },
      {
        title: 'Locations',
        slug: 'locations',
        singular: 'Location',
        options: {
          slug_field: true
        },
        metafields: [
          {
            title: 'Description',
            key: 'description',
            type: 'text',
            value: '',
            config: {
              required: false
            }
          },
          {
            title: 'Image',
            key: 'image',
            type: 'file',
            value: '',
            config: {
              required: false
            }
          }
        ]
      }
    ];

    // Delete existing object types first
    for (const objectType of objectTypes) {
      try {
        console.log(`Deleting ${objectType.title} object type if it exists...`);
        await cosmic.objectTypes.deleteOne(objectType.slug).catch(() => { });
      } catch (error) {
        // Ignore errors here as the object type might not exist
      }
    }

    // Create new object types
    for (const objectType of objectTypes) {
      try {
        console.log(`Creating ${objectType.title} object type...`);
        await cosmic.objectTypes.insertOne(objectType);
        console.log(`Created ${objectType.title} successfully`);
      } catch (error) {
        console.error(`Error creating ${objectType.title}:`, error.message || error);
      }
    }

    console.log('Object types setup completed');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupObjectTypes()
    .then(() => {
      console.log('Setup completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
} 