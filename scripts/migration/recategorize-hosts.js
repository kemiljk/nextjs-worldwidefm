const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createBucketClient } = require('@cosmicjs/sdk');
const nlp = require('compromise');

// Register compromise plugins for better entity recognition
nlp.extend(require('compromise-numbers'));
nlp.extend(require('compromise-dates'));

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

// Enhanced genre detection with hierarchical categories
const genreCategories = {
  electronic: ['house', 'techno', 'ambient', 'idm', 'drum and bass', 'dubstep', 'garage', 'grime', 'electronica', 'synth', 'beats', 'broken beat', 'breakbeat'],
  hiphop: ['rap', 'hip hop', 'hip-hop', 'trap', 'boom bap', 'turntablism'],
  jazz: ['bebop', 'fusion', 'modal', 'free jazz', 'spiritual jazz', 'jazz funk', 'nu jazz', 'acid jazz'],
  world: ['afro', 'latin', 'brazilian', 'african', 'caribbean', 'tropical', 'world music', 'global', 'gnawa', 'highlife'],
  roots: ['reggae', 'dub', 'ska', 'rocksteady', 'roots', 'dancehall'],
  soul: ['funk', 'soul', 'rnb', 'r&b', 'motown', 'disco', 'groove'],
  rock: ['rock', 'metal', 'punk', 'indie', 'alternative', 'psychedelic', 'prog'],
  classical: ['classical', 'orchestra', 'chamber', 'symphony', 'concerto', 'piano', 'strings'],
  folk: ['folk', 'acoustic', 'traditional', 'singer-songwriter'],
  experimental: ['avant-garde', 'experimental', 'noise', 'ambient', 'drone', 'abstract'],
  instruments: ['piano', 'guitar', 'drums', 'bass', 'percussion', 'horns', 'strings', 'synthesizer', 'flute', 'saxophone']
};

// Comprehensive location database
const locationData = {
  continents: ['africa', 'asia', 'europe', 'north america', 'south america', 'australia', 'antarctica'],
  regions: ['caribbean', 'middle east', 'southeast asia', 'latin america', 'scandinavia', 'mediterranean'],
  major_cities: ['london', 'new york', 'paris', 'berlin', 'tokyo', 'los angeles', 'chicago', 'amsterdam'],
  countries: require('countries-list').countries
};

const commonGenres = new Set([
  // Music Genres
  'hip hop', 'piano', 'flute', 'jazz', 'funk', 'soul', 'reggae', 'electronic', 'house', 'techno',
  'ambient', 'experimental', 'classical', 'rock', 'pop', 'folk', 'world', 'latin', 'blues',
  'disco', 'drum and bass', 'dubstep', 'garage', 'grime', 'rap', 'rnb', 'r&b', 'afrobeat',
  'bossa nova', 'samba', 'salsa', 'cumbia', 'merengue', 'bachata', 'reggaeton', 'dancehall',
  'dub', 'ska', 'rocksteady', 'calypso', 'zouk', 'kompa', 'compas', 'roots', 'tribal',
  'traditional', 'fusion', 'contemporary', 'modern', 'alternative', 'indie', 'punk', 'metal',
  'hardcore', 'industrial', 'noise', 'drone', 'psychedelic', 'progressive', 'avant garde',
  'free jazz', 'bebop', 'swing', 'big band', 'orchestra', 'chamber', 'symphony', 'opera',
  'choral', 'vocal', 'acapella', 'instrumental', 'acoustic', 'electric', 'electronic',
  'synthesizer', 'digital', 'analog', 'live', 'recorded', 'studio', 'remix', 'cover',
  'original', 'classic', 'vintage', 'retro', 'future', 'nu', 'neo', 'post',
  // Instruments
  'guitar', 'drums', 'bass', 'keyboard', 'synthesizer', 'piano', 'violin', 'cello', 'trumpet',
  'saxophone', 'flute', 'clarinet', 'percussion', 'strings', 'brass', 'woodwind', 'electronic',
  'acoustic', 'electric', 'digital', 'analog', 'modular', 'virtual', 'software', 'hardware',
  // Compound Genres
  'post bop', 'nu jazz', 'acid jazz', 'jazz funk', 'soul jazz', 'latin jazz', 'afro jazz',
  'free jazz', 'jazz fusion', 'contemporary jazz', 'modern jazz', 'traditional jazz',
  'electronic jazz', 'jazz rock', 'jazz pop', 'jazz folk', 'jazz world', 'jazz experimental',
  'jazz ambient', 'jazz classical', 'jazz orchestral', 'jazz vocal', 'jazz instrumental'
]);

const takeoverIndicators = {
  prefixes: ['radio', 'studio', 'project', 'collective', 'label', 'records', 'recordings',
    'productions', 'presents', 'showcase', 'series', 'sessions', 'sound system', 'soundsystem',
    'crew', 'family', 'tribe', 'movement', 'foundation', 'institute', 'association', 'society',
    'club', 'group', 'ensemble', 'orchestra', 'band', 'duo', 'trio', 'quartet', 'quintet',
    'sextet', 'septet', 'octet', 'nonet', 'dectet', 'the', 'team', 'unit', 'division',
    'department', 'office', 'bureau', 'agency', 'organization', 'organisation', 'company',
    'corporation', 'incorporated', 'inc', 'ltd', 'limited', 'llc', 'llp', 'lp', 'plc',
    'international', 'global', 'worldwide', 'national', 'regional', 'local', 'community',
    'public', 'private', 'independent', 'indie', 'underground', 'alternative', 'experimental',
    'avant garde', 'progressive', 'traditional', 'contemporary', 'modern', 'classic', 'vintage',
    'retro', 'future', 'nu', 'neo', 'post'],
  suffixes: ['radio', 'fm', 'am', 'broadcast', 'broadcasting', 'productions', 'records',
    'recordings', 'label', 'music', 'sound', 'audio', 'media', 'entertainment', 'presents',
    'presents', 'showcase', 'series', 'sessions', 'collective', 'crew', 'family', 'tribe',
    'movement', 'foundation', 'institute', 'association', 'society', 'club', 'group',
    'ensemble', 'orchestra', 'band', 'duo', 'trio', 'quartet', 'quintet', 'sextet',
    'septet', 'octet', 'nonet', 'dectet', 'international', 'global', 'worldwide',
    'national', 'regional', 'local', 'community'],
  patterns: [
    /^the\s+/i,
    /\s+radio$/i,
    /\s+fm$/i,
    /\s+am$/i,
    /\s+records$/i,
    /\s+recordings$/i,
    /\s+label$/i,
    /\s+music$/i,
    /\s+sound$/i,
    /\s+audio$/i,
    /\s+media$/i,
    /\s+entertainment$/i,
    /\s+presents$/i,
    /\s+showcase$/i,
    /\s+series$/i,
    /\s+sessions$/i,
    /\s+collective$/i,
    /\s+crew$/i,
    /\s+family$/i,
    /\s+tribe$/i,
    /\s+movement$/i,
    /\s+foundation$/i,
    /\s+institute$/i,
    /\s+association$/i,
    /\s+society$/i,
    /\s+club$/i,
    /\s+group$/i,
    /\s+ensemble$/i,
    /\s+orchestra$/i,
    /\s+band$/i,
    /\s+duo$/i,
    /\s+trio$/i,
    /\s+quartet$/i,
    /\s+quintet$/i,
    /\s+sextet$/i,
    /\s+septet$/i,
    /\s+octet$/i,
    /\s+nonet$/i,
    /\s+dectet$/i,
    /\s+international$/i,
    /\s+global$/i,
    /\s+worldwide$/i,
    /\s+national$/i,
    /\s+regional$/i,
    /\s+local$/i,
    /\s+community$/i
  ]
};

// Helper function for fuzzy matching
function fuzzyMatch(str, array) {
  const normalized = str.toLowerCase().trim();
  return array.some(item => {
    const normalizedItem = item.toLowerCase().trim();
    return normalized.includes(normalizedItem) || normalizedItem.includes(normalized);
  });
}

// Enhanced genre detection
function detectGenre(title) {
  const normalized = title.toLowerCase().trim();
  const doc = nlp(title);

  // Check for explicit genre terms
  if (commonGenres.has(normalized)) {
    return { isGenre: true, category: 'direct match' };
  }

  // Check for compound genres (e.g., "jazz funk", "electronic soul")
  const words = normalized.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const compound = words[i] + ' ' + words[i + 1];
    if (commonGenres.has(compound)) {
      return { isGenre: true, category: 'compound' };
    }
  }

  // Check each genre category
  for (const [category, genres] of Object.entries(genreCategories)) {
    if (fuzzyMatch(normalized, genres)) {
      return { isGenre: true, category };
    }
  }

  // Check for genre-like patterns
  const genrePatterns = [
    /^nu\s+/i,
    /^neo\s+/i,
    /^post\s+/i,
    /^avant\s+/i,
    /^free\s+/i,
    /^jazz\s+/i,
    /^world\s+/i,
    /^folk\s+/i,
    /^electronic\s+/i,
    /^experimental\s+/i
  ];

  if (genrePatterns.some(pattern => pattern.test(normalized))) {
    return { isGenre: true, category: 'pattern match' };
  }

  return { isGenre: false };
}

// Enhanced location detection
function detectLocation(title) {
  const normalized = title.toLowerCase().trim();
  const doc = nlp(title);

  // Skip if it's a likely genre
  if (detectGenre(title).isGenre) {
    return { isLocation: false };
  }

  // Use compromise for place detection
  const places = doc.places();
  if (places.length > 0) {
    // Verify against our location database to reduce false positives
    const placeText = places.text().toLowerCase();
    if (fuzzyMatch(placeText, locationData.continents) ||
      fuzzyMatch(placeText, locationData.regions) ||
      fuzzyMatch(placeText, locationData.major_cities) ||
      fuzzyMatch(placeText, Object.values(locationData.countries).map(c => c.name.toLowerCase()))) {
      return { isLocation: true };
    }
  }

  // Check for location adjectives (e.g., "French", "Brazilian")
  const adjectives = doc.match('#Adjective').text().toLowerCase();
  if (adjectives && Object.values(locationData.countries).some(country =>
    adjectives.includes(country.name.toLowerCase()) ||
    country.name.toLowerCase().includes(adjectives)
  )) {
    return { isLocation: true };
  }

  // Direct check against location database
  if (fuzzyMatch(normalized, locationData.continents) ||
    fuzzyMatch(normalized, locationData.regions) ||
    fuzzyMatch(normalized, locationData.major_cities) ||
    fuzzyMatch(normalized, Object.values(locationData.countries).map(c => c.name.toLowerCase()))) {
    return { isLocation: true };
  }

  return { isLocation: false };
}

// Enhanced person detection
function detectPerson(title) {
  const doc = nlp(title);

  // Skip if it's a likely genre or location
  if (detectGenre(title).isGenre || detectLocation(title).isLocation) {
    return { isPerson: false };
  }

  // Use compromise for person detection
  const people = doc.people();
  if (people.length > 0) {
    // Verify it looks like a real name
    const nameText = people.text();
    const words = nameText.split(/\s+/);

    // Check if it follows typical name patterns
    if (words.length >= 2 && words.length <= 4 &&
      words.every(word => word[0] === word[0].toUpperCase())) {
      return { isPerson: true };
    }
  }

  // Check for DJ names and artist patterns
  const djPattern = /^(dj|mc)\s+\w+/i;
  const artistPattern = /(the\s+)?[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}/;

  if (djPattern.test(title) || artistPattern.test(title)) {
    return { isPerson: true };
  }

  return { isPerson: false };
}

// Enhanced takeover detection
function detectTakeover(title) {
  const normalized = title.toLowerCase().trim();
  const doc = nlp(title);

  // Skip if it's a likely person, genre, or location
  if (detectPerson(title).isPerson ||
    detectGenre(title).isGenre ||
    detectLocation(title).isLocation) {
    return false;
  }

  // Check for organization indicators in prefixes
  for (const prefix of takeoverIndicators.prefixes) {
    if (normalized.startsWith(prefix + ' ')) {
      return true;
    }
  }

  // Check for organization indicators in suffixes
  for (const suffix of takeoverIndicators.suffixes) {
    if (normalized.endsWith(' ' + suffix)) {
      return true;
    }
  }

  // Check for organization patterns
  const orgPatterns = [
    /radio/i,
    /records?/i,
    /recordings?/i,
    /productions?/i,
    /studios?/i,
    /collective/i,
    /sessions?/i,
    /presents/i,
    /showcase/i,
    /soundsystem/i,
    /worldwide/i,
    /international/i
  ];

  if (orgPatterns.some(pattern => pattern.test(normalized))) {
    return true;
  }

  // Check for ALL CAPS names (often brands/organizations)
  if (title === title.toUpperCase() && title.length > 3) {
    return true;
  }

  // Check for collaborative patterns
  if (normalized.includes(' & ') || normalized.includes(' and ')) {
    // Exclude person names like "Simon & Garfunkel"
    if (!detectPerson(title).isPerson) {
      return true;
    }
  }

  return false;
}

async function recategorizeHosts(dryRun = true) {
  try {
    console.log(`Starting intelligent recategorization of Regular Hosts... ${dryRun ? '(DRY RUN)' : ''}`);

    const stats = {
      genres: 0,
      locations: 0,
      takeovers: 0,
      unchanged: 0,
      errors: 0,
      confidence: {
        high: 0,
        medium: 0,
        low: 0
      }
    };

    let skip = 0;
    const limit = 100;
    let totalProcessed = 0;

    while (true) {
      try {
        console.log(`\nFetching batch (skip: ${skip}, limit: ${limit})...`);
        const response = await cosmic.objects
          .find({
            type: 'regular-hosts'
          })
          .props(['id', 'title', 'slug', 'metadata'])
          .limit(limit)
          .skip(skip)
          .depth(1)
          .status('published');

        if (!response.objects || response.objects.length === 0) {
          console.log('No more hosts to process.');
          break;
        }

        const hosts = response.objects;
        console.log(`Processing ${hosts.length} hosts...`);

        for (const host of hosts) {
          try {
            const title = host.title;
            let newType = null;
            let reason = '';
            let confidence = 'low';

            // Perform multiple detection checks
            const genreResult = detectGenre(title);
            const locationResult = detectLocation(title);
            const personResult = detectPerson(title);
            const takeoverResult = detectTakeover(title);

            // Count how many categories it matches
            const matches = [
              genreResult.isGenre,
              locationResult.isLocation,
              personResult.isPerson,
              takeoverResult
            ].filter(Boolean).length;

            if (matches > 1) {
              // If multiple matches, we need more context
              console.log(`[AMBIGUOUS] "${title}" matches multiple categories - keeping as regular host`);
              stats.unchanged++;
              continue;
            }

            if (genreResult.isGenre) {
              newType = 'genres';
              reason = `detected as ${genreResult.category} genre`;
              confidence = 'high';
              stats.genres++;
            } else if (locationResult.isLocation) {
              newType = 'locations';
              reason = 'detected as location';
              confidence = 'high';
              stats.locations++;
            } else if (takeoverResult) {
              newType = 'takeovers';
              reason = 'detected as takeover';
              confidence = 'high';
              stats.takeovers++;
            } else if (personResult.isPerson) {
              // Keep as regular host but mark as confirmed person
              console.log(`[PERSON] Keeping "${title}" as regular host`);
              stats.unchanged++;
              continue;
            } else {
              stats.unchanged++;
              console.log(`[UNKNOWN] Keeping "${title}" as regular host`);
              continue;
            }

            stats.confidence[confidence]++;

            if (newType) {
              console.log(`[${confidence.toUpperCase()}] ${dryRun ? 'Would move' : 'Moving'} "${title}" to ${newType} (${reason})`);

              if (!dryRun) {
                try {
                  const newObject = await cosmic.objects.insertOne({
                    title: host.title,
                    type: newType,
                    slug: host.slug,
                    metadata: {}
                  });

                  if (newObject) {
                    console.log(`Successfully created ${newType} object for "${title}"`);
                    await cosmic.objects.deleteOne(host.id);
                    console.log(`Successfully deleted original host "${title}"`);
                  } else {
                    throw new Error('Failed to create new object');
                  }
                } catch (error) {
                  console.error(`Failed to process "${title}":`, error.message || error);
                  stats.errors++;
                  continue;
                }
              }
            }
          } catch (hostError) {
            console.error(`Error processing host "${host.title}":`, hostError);
            stats.errors++;
          }
        }

        totalProcessed += hosts.length;
        console.log(`\nProcessed ${totalProcessed} hosts so far`);

        if (hosts.length < limit) {
          console.log('Reached end of hosts.');
          break;
        }

        skip += limit;
      } catch (batchError) {
        console.error('Error fetching batch:', batchError);
        stats.errors++;
        break;
      }
    }

    console.log('\nRecategorization completed:');
    console.log(`- Moved to genres: ${stats.genres}`);
    console.log(`- Moved to locations: ${stats.locations}`);
    console.log(`- Moved to takeovers: ${stats.takeovers}`);
    console.log(`- Kept as hosts: ${stats.unchanged}`);
    console.log(`- Errors encountered: ${stats.errors}`);
    console.log('\nConfidence levels:');
    console.log(`- High confidence: ${stats.confidence.high}`);
    console.log(`- Medium confidence: ${stats.confidence.medium}`);
    console.log(`- Low confidence: ${stats.confidence.low}`);

    if (dryRun) {
      console.log('\nThis was a dry run. No changes were made.');
      console.log('Run with --apply to apply changes.');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the recategorization
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  recategorizeHosts(!shouldApply)
    .then(() => {
      if (shouldApply) {
        console.log('\nChanges have been applied successfully.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to run recategorization:', error);
      process.exit(1);
    });
} 