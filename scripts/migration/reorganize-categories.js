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

// Helper function to normalize strings for comparison
function normalizeString(str) {
  return str.toLowerCase()
    .replace(/[-_&]/g, ' ')  // Replace hyphens, underscores, and ampersands with spaces
    .replace(/\s+/g, ' ')    // Normalize multiple spaces
    .trim();                 // Remove leading/trailing spaces
}

// Calculate similarity between two strings (0-1)
function stringSimilarity(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  const pairs1 = new Set();
  const pairs2 = new Set();

  // Create character pairs
  for (let i = 0; i < s1.length - 1; i++) {
    pairs1.add(s1.slice(i, i + 2));
  }
  for (let i = 0; i < s2.length - 1; i++) {
    pairs2.add(s2.slice(i, i + 2));
  }

  const union = new Set([...pairs1, ...pairs2]);
  const intersection = new Set([...pairs1].filter(x => pairs2.has(x)));

  return 2.0 * intersection.size / (pairs1.size + pairs2.size);
}

// Categorization rules (reused from categorize-tags.js)
const commonGenres = new Set([
  'worldmusic', 'afro', 'latin', 'brazilian', 'jazz', 'funk', 'soul', 'electronic',
  'house', 'techno', 'ambient', 'experimental', 'pop', 'rock', 'classical', 'folk',
  'reggae', 'dub', 'hiphop', 'rap', 'rnb', 'blues', 'country', 'metal', 'punk',
  'indie', 'alternative', 'dance', 'disco', 'dubstep', 'garage', 'grime', 'trap',
  'calypso', 'samba', 'bossanova', 'salsa', 'merengue', 'cumbia', 'reggaeton',
  'ska', 'rocksteady', 'roots', 'worldbeat', 'fusion', 'tribal', 'traditional'
]);

const contentTypes = new Set([
  'interview', 'podcast', 'mix', 'live', 'session', 'special', 'series',
  'compilation', 'playlist', 'broadcast', 'stream', 'recording', 'performance',
  'set', 'radio show', 'live set', 'dj set', 'mixtape', 'album', 'ep', 'single'
]);

const locations = new Set([
  'chicago', 'london', 'paris', 'berlin', 'tokyo', 'new york', 'los angeles',
  'miami', 'detroit', 'atlanta', 'seattle', 'portland', 'boston', 'amsterdam',
  'africa', 'asia', 'europe', 'america', 'australia', 'brazil', 'japan', 'china',
  'india', 'russia', 'mexico', 'canada', 'spain', 'france', 'germany', 'italy',
  'uk', 'usa', 'caribbean', 'mediterranean', 'scandinavia', 'middle east'
]);

// Helper functions for categorization
function isGenre(title) {
  const normalized = normalizeString(title);
  return commonGenres.has(normalized) ||
    Array.from(commonGenres).some(genre =>
      normalized.includes(genre) || genre.includes(normalized)
    );
}

function isLocation(title) {
  const normalized = normalizeString(title);
  return locations.has(normalized) ||
    Array.from(locations).some(location =>
      normalized.includes(location) || location.includes(normalized)
    );
}

function isContentType(title) {
  const normalized = normalizeString(title);
  return contentTypes.has(normalized) ||
    Array.from(contentTypes).some(type =>
      normalized.includes(type) || type.includes(normalized)
    );
}

function isTakeover(title) {
  const normalized = normalizeString(title);
  const takeoverIndicators = [
    'records', 'recordings', 'label', 'productions', 'studios',
    'sound system', 'collective', 'radio', 'fm', 'presents',
    'takeover', 'showcase', 'festival'
  ];

  return takeoverIndicators.some(indicator => normalized.includes(indicator));
}

function isRegularHost(title) {
  // If it's clearly something else, return false
  if (isGenre(title) || isLocation(title) || isContentType(title) || isTakeover(title)) {
    return false;
  }

  const normalized = normalizeString(title);
  // Check if it looks like a person's name (1-3 words, no special characters)
  const words = normalized.split(' ');
  return words.length >= 1 && words.length <= 3 && /^[a-z\s]+$/.test(normalized);
}

function determineCategory(title) {
  if (isGenre(title)) return 'genres';
  if (isLocation(title)) return 'locations';
  if (isContentType(title)) return 'types';
  if (isTakeover(title)) return 'takeovers';
  if (isRegularHost(title)) return 'regular-hosts';
  return 'takeovers'; // Default category if nothing else matches
}

async function reorganizeCategories(dryRun = true) {
  try {
    console.log(`Starting category reorganization... ${dryRun ? '(DRY RUN)' : ''}`);
    const cosmic = createBucketClient(COSMIC_CONFIG);

    // Step 1: Fetch all objects from all categories
    const allObjects = [];
    for (const type of OBJECT_TYPES) {
      console.log(`\nFetching ${type}...`);
      let skip = 0;
      const limit = 100;

      try {
        while (true) {
          const response = await cosmic.objects
            .find({
              type: type,
            })
            .props(['id', 'title', 'slug', 'metadata'])
            .limit(limit)
            .skip(skip)
            .depth(1)
            .status('published');

          if (!response.objects || response.objects.length === 0) {
            console.log(`No objects found for type: ${type}`);
            break;
          }

          allObjects.push(...response.objects.map(obj => ({
            ...obj,
            currentType: type
          })));

          console.log(`Fetched ${response.objects.length} objects`);

          if (response.objects.length < limit) break;
          skip += limit;
        }
      } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        continue;
      }
    }

    console.log(`\nTotal objects fetched: ${allObjects.length}`);

    // Step 2: Recategorize and deduplicate
    const categorizedObjects = new Map(); // key: normalized title, value: object
    const stats = {
      total: allObjects.length,
      recategorized: 0,
      duplicatesRemoved: 0,
      byType: Object.fromEntries(OBJECT_TYPES.map(type => [type, 0]))
    };

    for (const obj of allObjects) {
      const normalizedTitle = normalizeString(obj.title);
      const newCategory = determineCategory(obj.title);

      // Check for similar existing objects
      let isDuplicate = false;
      for (const [existingTitle, existingObj] of categorizedObjects.entries()) {
        if (stringSimilarity(normalizedTitle, existingTitle) > 0.8) {
          console.log(`Found duplicate: "${obj.title}" matches "${existingObj.title}"`);
          stats.duplicatesRemoved++;
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        if (newCategory !== obj.currentType) {
          console.log(`Recategorizing: "${obj.title}" from ${obj.currentType} to ${newCategory}`);
          stats.recategorized++;
        }
        categorizedObjects.set(normalizedTitle, {
          ...obj,
          newType: newCategory
        });
        stats.byType[newCategory]++;
      }
    }

    // Step 3: If not a dry run, delete all existing objects and create new ones
    if (!dryRun) {
      console.log('\nDeleting existing objects...');
      for (const obj of allObjects) {
        await cosmic.objects.deleteOne(obj.id);
      }

      console.log('\nCreating new objects...');
      for (const [_, obj] of categorizedObjects) {
        await cosmic.objects.insertOne({
          title: obj.title,
          type: obj.newType,
          slug: obj.slug,
          metadata: obj.metadata || {}
        });
      }
    }

    // Print statistics
    console.log('\nReorganization completed:');
    console.log(`Total objects processed: ${stats.total}`);
    console.log(`Objects recategorized: ${stats.recategorized}`);
    console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
    console.log('\nFinal category counts:');
    for (const type of OBJECT_TYPES) {
      console.log(`${type}: ${stats.byType[type]}`);
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

// Run the reorganization
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  reorganizeCategories(!shouldApply)
    .then(() => {
      if (shouldApply) {
        console.log('\nChanges have been applied successfully.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to run reorganization:', error);
      process.exit(1);
    });
} 