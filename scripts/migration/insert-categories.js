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

// List of objects to insert
const objectsToInsert = {
  genres: [
    'House', 'Techno', 'Jazz', 'Funk', 'Soul', 'Electronic', 'Ambient',
    'Experimental', 'Pop', 'Rock', 'Classical', 'Folk', 'Reggae', 'Dub',
    'Hip Hop', 'R&B', 'Blues', 'Country', 'Metal', 'Punk', 'Indie',
    'Alternative', 'Dance', 'Disco', 'Dubstep', 'Garage', 'Grime', 'Trap',
    'Calypso', 'Samba', 'Bossa Nova', 'Salsa', 'Merengue', 'Cumbia',
    'Reggaeton', 'Ska', 'Rocksteady', 'Roots', 'Worldbeat', 'Fusion',
    'Tribal', 'Traditional', 'World Music', 'Afro', 'Latin', 'Brazilian'
  ],
  'regular-hosts': [
    'John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams', 'David Brown',
    'Lisa Anderson', 'Tom Wilson', 'Emma Davis', 'Chris Taylor', 'Amy Lee'
  ],
  locations: [
    'Chicago', 'London', 'Paris', 'Berlin', 'Tokyo', 'New York', 'Los Angeles',
    'Miami', 'Detroit', 'Atlanta', 'Seattle', 'Portland', 'Boston', 'Amsterdam',
    'Africa', 'Asia', 'Europe', 'America', 'Australia', 'Brazil', 'Japan',
    'China', 'India', 'Russia', 'Mexico', 'Canada', 'Spain', 'France',
    'Germany', 'Italy', 'UK', 'USA', 'Caribbean', 'Mediterranean',
    'Scandinavia', 'Middle East'
  ],
  takeovers: [
    'Record Label Takeover', 'Artist Showcase', 'Festival Special',
    'Label Spotlight', 'Artist Series', 'Special Broadcast',
    'Radio Takeover', 'Studio Session', 'Live Performance',
    'Artist Presents', 'Label Presents', 'Special Event'
  ],
  types: [
    'Interview', 'Podcast', 'Mix', 'Live', 'Session', 'Special', 'Series',
    'Compilation', 'Playlist', 'Broadcast', 'Stream', 'Recording',
    'Performance', 'Set', 'Radio Show', 'Live Set', 'DJ Set', 'Mixtape',
    'Album', 'EP', 'Single'
  ]
};

async function insertCategories(dryRun = true) {
  try {
    console.log(`Starting category insertion... ${dryRun ? '(DRY RUN)' : ''}`);
    const cosmic = createBucketClient(COSMIC_CONFIG);

    const stats = {
      total: 0,
      inserted: 0,
      errors: 0,
      byType: Object.fromEntries(Object.keys(objectsToInsert).map(type => [type, 0]))
    };

    for (const [type, objects] of Object.entries(objectsToInsert)) {
      console.log(`\nProcessing ${type}...`);
      stats.total += objects.length;

      for (const title of objects) {
        try {
          const slug = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

          // Check if object already exists
          try {
            const existing = await cosmic.objects
              .find({
                type,
                slug
              })
              .limit(1);

            if (existing.objects && existing.objects.length > 0) {
              console.log(`Skipping existing: ${title}`);
              stats.inserted++;
              stats.byType[type]++;
              continue;
            }
          } catch (error) {
            // 404 means object doesn't exist, which is what we want
            if (error.status !== 404) {
              throw error;
            }
          }

          if (!dryRun) {
            await cosmic.objects.insertOne({
              title,
              type,
              slug
            });
            stats.inserted++;
            stats.byType[type]++;
            console.log(`Inserted: ${title}`);
          } else {
            console.log(`Would insert: ${title}`);
            stats.inserted++;
            stats.byType[type]++;
          }
        } catch (error) {
          console.error(`Error inserting ${title}:`, error);
          stats.errors++;
        }
      }
    }

    console.log('\nInsertion completed:');
    console.log(`Total objects to insert: ${stats.total}`);
    console.log(`Successfully inserted: ${stats.inserted}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\nObjects by type:');
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(`${type}: ${count}`);
    }

    if (dryRun) {
      console.log('\nThis was a dry run. No changes were made.');
      console.log('Run with --apply to apply changes.');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the insertion
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  insertCategories(!shouldApply)
    .then(() => {
      if (shouldApply) {
        console.log('\nChanges have been applied successfully.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to run insertion:', error);
      process.exit(1);
    });
} 