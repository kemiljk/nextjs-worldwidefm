const path = require('path');
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

const OBJECT_TYPES = [
  'genres',
  'regular-hosts',
  'locations',
  'takeovers',
  'types'
];

const METAFIELDS_TO_REMOVE = ['description', 'image'];

async function removeMetafields(dryRun = true) {
  try {
    console.log(`Starting metafield removal... ${dryRun ? '(DRY RUN)' : ''}`);

    // Initialize Cosmic client
    const cosmic = createBucketClient(COSMIC_CONFIG);

    console.log('Cosmic config:', {
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? process.env.NEXT_PUBLIC_COSMIC_READ_KEY.slice(0, 5) + '...' : undefined,
      writeKey: process.env.COSMIC_WRITE_KEY ? process.env.COSMIC_WRITE_KEY.slice(0, 5) + '...' : undefined,
    });

    // Stats object to track progress
    const stats = {
      totalProcessed: 0,
      totalUpdated: 0,
      errors: 0,
      byType: {}
    };

    // Initialize stats for each type
    OBJECT_TYPES.forEach(type => {
      stats.byType[type] = {
        processed: 0,
        updated: 0,
        errors: 0
      };
    });

    for (const objectType of OBJECT_TYPES) {
      console.log(`\nProcessing ${objectType}...`);
      let skip = 0;
      const limit = 100;

      while (true) {
        try {
          console.log(`Fetching batch (skip: ${skip}, limit: ${limit})...`);
          const response = await cosmic.objects
            .find({
              type: objectType,
            })
            .props(['id', 'title', 'slug', 'metadata'])
            .limit(limit)
            .skip(skip)
            .depth(1)
            .status('published');

          if (!response.objects || response.objects.length === 0) {
            console.log('No more objects to process.');
            break;
          }

          const objects = response.objects;
          console.log(`Processing ${objects.length} objects...`);

          for (const obj of objects) {
            try {
              stats.totalProcessed++;
              stats.byType[objectType].processed++;

              // Check if object has any of the metafields we want to remove
              const hasMetafieldsToRemove = METAFIELDS_TO_REMOVE.some(field =>
                obj.metadata && obj.metadata[field] !== undefined
              );

              if (hasMetafieldsToRemove) {
                console.log(`${dryRun ? 'Would remove' : 'Removing'} metafields from "${obj.title}"`);

                if (!dryRun) {
                  // Create a new metadata object and set fields to empty strings
                  const newMetadata = { ...obj.metadata };
                  METAFIELDS_TO_REMOVE.forEach(field => {
                    newMetadata[field] = '';
                  });

                  // Update the object using the correct API method
                  await cosmic.objects.updateOne(obj.id, {
                    metadata: newMetadata
                  });
                }

                stats.totalUpdated++;
                stats.byType[objectType].updated++;
              }
            } catch (objError) {
              console.error(`Error processing object "${obj.title}":`, objError);
              stats.errors++;
              stats.byType[objectType].errors++;
            }
          }

          if (objects.length < limit) {
            console.log('Reached end of objects.');
            break;
          }

          skip += limit;
        } catch (batchError) {
          console.error('Error fetching batch:', batchError);
          stats.errors++;
          stats.byType[objectType].errors++;
          break;
        }
      }
    }

    console.log('\nMetafield removal completed:');
    console.log(`Total objects processed: ${stats.totalProcessed}`);
    console.log(`Total objects updated: ${stats.totalUpdated}`);
    console.log(`Total errors: ${stats.errors}`);

    console.log('\nBreakdown by type:');
    Object.entries(stats.byType).forEach(([type, typeStats]) => {
      console.log(`\n${type}:`);
      console.log(`- Processed: ${typeStats.processed}`);
      console.log(`- Updated: ${typeStats.updated}`);
      console.log(`- Errors: ${typeStats.errors}`);
    });

    if (dryRun) {
      console.log('\nThis was a dry run. No changes were made.');
      console.log('Run with --apply to apply changes.');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the metafield removal
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  removeMetafields(!shouldApply)  // Run in non-dry-run mode if --apply is present
    .then(() => {
      if (shouldApply) {
        console.log('\nChanges have been applied successfully.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to run metafield removal:', error);
      process.exit(1);
    });
} 