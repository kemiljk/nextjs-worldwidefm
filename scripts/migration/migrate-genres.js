const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createBucketClient } = require('@cosmicjs/sdk');
const nlp = require('compromise');

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

// Import common genres from categorize-tags.js
const commonGenres = new Set([
  'worldmusic', 'afro', 'latin', 'brazilian', 'jazz', 'funk', 'soul', 'electronic',
  'house', 'techno', 'ambient', 'experimental', 'pop', 'rock', 'classical', 'folk',
  'reggae', 'dub', 'hiphop', 'rap', 'rnb', 'blues', 'country', 'metal', 'punk',
  'indie', 'alternative', 'dance', 'disco', 'dubstep', 'garage', 'grime', 'trap',
  'calypso', 'samba', 'bossanova', 'salsa', 'merengue', 'cumbia', 'reggaeton',
  'ska', 'rocksteady', 'roots', 'worldbeat', 'fusion', 'tribal', 'traditional',
  'instrumental', 'vocal', 'acapella', 'acoustic', 'electric', 'live', 'studio',
  'remix', 'cover', 'original', 'mashup', 'beats', 'bass', 'drum', 'percussion',
  'strings', 'brass', 'woodwind', 'synthesizer', 'digital', 'analog', 'lofi',
  'hifi', 'experimental', 'avantgarde', 'progressive', 'psychedelic',
  'spiritual', 'gospel', 'sacred', 'secular', 'urban', 'rural', 'tribal',
  'indigenous', 'modern', 'contemporary', 'classic', 'vintage', 'retro', 'future'
]);

// Helper function to normalize genre names
function normalizeGenre(genre) {
  return genre.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
    .replace(/\s+/g, ' ')         // Normalize spaces
    .trim();                      // Trim whitespace
}

// Helper function to detect compound genres
function detectCompoundGenres(genre) {
  const normalized = normalizeGenre(genre);
  const words = normalized.split(' ');

  if (words.length < 2) return null;

  // Find all possible combinations of words that form valid genres
  const combinations = [];
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j <= words.length; j++) {
      const combination = words.slice(i, j).join(' ');
      if (commonGenres.has(combination)) {
        combinations.push(combination);
      }
    }
  }

  return combinations.length > 0 ? combinations : null;
}

// Helper function to analyze genre relationships
function analyzeGenreRelationships(genre) {
  const doc = nlp(genre);
  const terms = doc.terms().out('array');

  // Find related genres based on term similarity
  const relatedGenres = Array.from(commonGenres).filter(g => {
    const similarity = terms.some(term => g.includes(term) || term.includes(g));
    return similarity && g !== genre;
  });

  return relatedGenres;
}

// Helper function to consolidate genres
function consolidateGenre(genre) {
  const normalized = normalizeGenre(genre);

  // Check if it's already a standard genre
  if (commonGenres.has(normalized)) {
    return normalized;
  }

  // Find related genres
  const related = analyzeGenreRelationships(normalized);

  // If we found related genres, use the most common one
  if (related.length > 0) {
    return related[0];
  }

  // Check for compound genres
  const compounds = detectCompoundGenres(normalized);
  if (compounds) {
    return compounds.join(' ');
  }

  return normalized;
}

async function migrateGenres(dryRun = true) {
  try {
    console.log(`Starting genre migration... ${dryRun ? '(DRY RUN)' : ''}`);

    const cosmic = createBucketClient(COSMIC_CONFIG);
    const stats = {
      processed: 0,
      consolidated: 0,
      split: 0,
      errors: 0
    };

    let skip = 0;
    const limit = 100;

    while (true) {
      const response = await cosmic.objects
        .find({
          type: 'genres',
        })
        .props(['id', 'title', 'slug', 'metadata'])
        .limit(limit)
        .skip(skip)
        .depth(1)
        .status('published');

      if (!response.objects || response.objects.length === 0) break;

      for (const genre of response.objects) {
        try {
          const originalTitle = genre.title;
          const consolidatedTitle = consolidateGenre(originalTitle);

          if (originalTitle !== consolidatedTitle) {
            console.log(`${dryRun ? 'Would update' : 'Updating'} "${originalTitle}" to "${consolidatedTitle}"`);

            if (!dryRun) {
              await cosmic.objects.updateOne(genre.id, {
                title: consolidatedTitle,
                slug: consolidatedTitle.toLowerCase().replace(/\s+/g, '-')
              });
            }

            stats.consolidated++;
          }

          stats.processed++;
        } catch (error) {
          console.error(`Error processing genre "${genre.title}":`, error);
          stats.errors++;
        }
      }

      if (response.objects.length < limit) break;
      skip += limit;
    }

    console.log('\nMigration completed:');
    console.log(`- Total genres processed: ${stats.processed}`);
    console.log(`- Genres consolidated: ${stats.consolidated}`);
    console.log(`- Errors encountered: ${stats.errors}`);

    if (dryRun) {
      console.log('\nThis was a dry run. No changes were made.');
      console.log('Run with --apply to apply changes.');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  migrateGenres(!shouldApply)
    .then(() => {
      if (shouldApply) {
        console.log('\nChanges have been applied successfully.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to run migration:', error);
      process.exit(1);
    });
} 