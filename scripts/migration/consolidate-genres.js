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

// Genre consolidation map
const genreConsolidationMap = {
  // R&B variations
  'rnb': 'r&b',
  'r&b': 'r&b',
  'r and b': 'r&b',
  'r & b': 'r&b',
  'randb': 'r&b',

  // Hip Hop variations
  'hiphop': 'hip hop',
  'hip-hop': 'hip hop',
  'hip hop': 'hip hop',

  // Electronic variations
  'electronica': 'electronic',
  'electro': 'electronic',
  'electronic': 'electronic',

  // Jazz variations
  'jazz': 'jazz',
  'jazz-funk': 'jazz funk',
  'jazzfunk': 'jazz funk',
  'jazz funk': 'jazz funk',

  // World variations
  'worldmusic': 'world music',
  'world music': 'world music',
  'world': 'world music',

  // Soul variations
  'soul': 'soul',
  'soul-jazz': 'soul jazz',
  'souljazz': 'soul jazz',
  'soul jazz': 'soul jazz',

  // Funk variations
  'funk': 'funk',
  'funk-jazz': 'funk jazz',
  'funkjazz': 'funk jazz',
  'funk jazz': 'funk jazz',

  // Reggae variations
  'reggae': 'reggae',
  'reggaeton': 'reggaeton',
  'reggaeton': 'reggaeton',

  // Latin variations
  'latin': 'latin',
  'latin-jazz': 'latin jazz',
  'latinjazz': 'latin jazz',
  'latin jazz': 'latin jazz',

  // Brazilian variations
  'brazilian': 'brazilian',
  'brazilian-jazz': 'brazilian jazz',
  'brazilianjazz': 'brazilian jazz',
  'brazilian jazz': 'brazilian jazz',

  // Afro variations
  'afro': 'afro',
  'afro-jazz': 'afro jazz',
  'afrojazz': 'afro jazz',
  'afro jazz': 'afro jazz',

  // Blues variations
  'blues': 'blues',
  'blues-jazz': 'blues jazz',
  'bluesjazz': 'blues jazz',
  'blues jazz': 'blues jazz',

  // Rock variations
  'rock': 'rock',
  'rock-jazz': 'rock jazz',
  'rockjazz': 'rock jazz',
  'rock jazz': 'rock jazz',

  // Folk variations
  'folk': 'folk',
  'folk-jazz': 'folk jazz',
  'folkjazz': 'folk jazz',
  'folk jazz': 'folk jazz',

  // Classical variations
  'classical': 'classical',
  'classical-jazz': 'classical jazz',
  'classicaljazz': 'classical jazz',
  'classical jazz': 'classical jazz',

  // Experimental variations
  'experimental': 'experimental',
  'experimental-jazz': 'experimental jazz',
  'experimentaljazz': 'experimental jazz',
  'experimental jazz': 'experimental jazz',

  // Ambient variations
  'ambient': 'ambient',
  'ambient-jazz': 'ambient jazz',
  'ambientjazz': 'ambient jazz',
  'ambient jazz': 'ambient jazz',

  // House variations
  'house': 'house',
  'house-jazz': 'house jazz',
  'housejazz': 'house jazz',
  'house jazz': 'house jazz',

  // Techno variations
  'techno': 'techno',
  'techno-jazz': 'techno jazz',
  'technojazz': 'techno jazz',
  'techno jazz': 'techno jazz',

  // Pop variations
  'pop': 'pop',
  'pop-jazz': 'pop jazz',
  'popjazz': 'pop jazz',
  'pop jazz': 'pop jazz',

  // Metal variations
  'metal': 'metal',
  'metal-jazz': 'metal jazz',
  'metaljazz': 'metal jazz',
  'metal jazz': 'metal jazz',

  // Punk variations
  'punk': 'punk',
  'punk-jazz': 'punk jazz',
  'punkjazz': 'punk jazz',
  'punk jazz': 'punk jazz',

  // Indie variations
  'indie': 'indie',
  'indie-jazz': 'indie jazz',
  'indiejazz': 'indie jazz',
  'indie jazz': 'indie jazz',

  // Alternative variations
  'alternative': 'alternative',
  'alternative-jazz': 'alternative jazz',
  'alternativejazz': 'alternative jazz',
  'alternative jazz': 'alternative jazz',

  // Dance variations
  'dance': 'dance',
  'dance-jazz': 'dance jazz',
  'dancejazz': 'dance jazz',
  'dance jazz': 'dance jazz',

  // Disco variations
  'disco': 'disco',
  'disco-jazz': 'disco jazz',
  'discojazz': 'disco jazz',
  'disco jazz': 'disco jazz',

  // Dubstep variations
  'dubstep': 'dubstep',
  'dubstep-jazz': 'dubstep jazz',
  'dubstepjazz': 'dubstep jazz',
  'dubstep jazz': 'dubstep jazz',

  // Garage variations
  'garage': 'garage',
  'garage-jazz': 'garage jazz',
  'garagejazz': 'garage jazz',
  'garage jazz': 'garage jazz',

  // Grime variations
  'grime': 'grime',
  'grime-jazz': 'grime jazz',
  'grimejazz': 'grime jazz',
  'grime jazz': 'grime jazz',

  // Trap variations
  'trap': 'trap',
  'trap-jazz': 'trap jazz',
  'trapjazz': 'trap jazz',
  'trap jazz': 'trap jazz',

  // Calypso variations
  'calypso': 'calypso',
  'calypso-jazz': 'calypso jazz',
  'calypsojazz': 'calypso jazz',
  'calypso jazz': 'calypso jazz',

  // Samba variations
  'samba': 'samba',
  'samba-jazz': 'samba jazz',
  'sambajazz': 'samba jazz',
  'samba jazz': 'samba jazz',

  // Bossa Nova variations
  'bossa nova': 'bossa nova',
  'bossa-nova': 'bossa nova',
  'bossanova': 'bossa nova',

  // Salsa variations
  'salsa': 'salsa',
  'salsa-jazz': 'salsa jazz',
  'salsajazz': 'salsa jazz',
  'salsa jazz': 'salsa jazz',

  // Merengue variations
  'merengue': 'merengue',
  'merengue-jazz': 'merengue jazz',
  'merenguejazz': 'merengue jazz',
  'merengue jazz': 'merengue jazz',

  // Cumbia variations
  'cumbia': 'cumbia',
  'cumbia-jazz': 'cumbia jazz',
  'cumbiajazz': 'cumbia jazz',
  'cumbia jazz': 'cumbia jazz',

  // Ska variations
  'ska': 'ska',
  'ska-jazz': 'ska jazz',
  'skajazz': 'ska jazz',
  'ska jazz': 'ska jazz',

  // Rocksteady variations
  'rocksteady': 'rocksteady',
  'rocksteady-jazz': 'rocksteady jazz',
  'rocksteadyjazz': 'rocksteady jazz',
  'rocksteady jazz': 'rocksteady jazz',

  // Roots variations
  'roots': 'roots',
  'roots-jazz': 'roots jazz',
  'rootsjazz': 'roots jazz',
  'roots jazz': 'roots jazz',

  // Worldbeat variations
  'worldbeat': 'worldbeat',
  'worldbeat-jazz': 'worldbeat jazz',
  'worldbeatjazz': 'worldbeat jazz',
  'worldbeat jazz': 'worldbeat jazz',

  // Fusion variations
  'fusion': 'fusion',
  'fusion-jazz': 'fusion jazz',
  'fusionjazz': 'fusion jazz',
  'fusion jazz': 'fusion jazz',

  // Tribal variations
  'tribal': 'tribal',
  'tribal-jazz': 'tribal jazz',
  'tribaljazz': 'tribal jazz',
  'tribal jazz': 'tribal jazz',

  // Traditional variations
  'traditional': 'traditional',
  'traditional-jazz': 'traditional jazz',
  'traditionaljazz': 'traditional jazz',
  'traditional jazz': 'traditional jazz',

  // Instrumental variations
  'instrumental': 'instrumental',
  'instrumental-jazz': 'instrumental jazz',
  'instrumentaljazz': 'instrumental jazz',
  'instrumental jazz': 'instrumental jazz',

  // Vocal variations
  'vocal': 'vocal',
  'vocal-jazz': 'vocal jazz',
  'vocaljazz': 'vocal jazz',
  'vocal jazz': 'vocal jazz',

  // Acapella variations
  'acapella': 'acapella',
  'acapella-jazz': 'acapella jazz',
  'acapellajazz': 'acapella jazz',
  'acapella jazz': 'acapella jazz',

  // Acoustic variations
  'acoustic': 'acoustic',
  'acoustic-jazz': 'acoustic jazz',
  'acousticjazz': 'acoustic jazz',
  'acoustic jazz': 'acoustic jazz',

  // Electric variations
  'electric': 'electric',
  'electric-jazz': 'electric jazz',
  'electricjazz': 'electric jazz',
  'electric jazz': 'electric jazz',

  // Live variations
  'live': 'live',
  'live-jazz': 'live jazz',
  'livejazz': 'live jazz',
  'live jazz': 'live jazz',

  // Studio variations
  'studio': 'studio',
  'studio-jazz': 'studio jazz',
  'studiojazz': 'studio jazz',
  'studio jazz': 'studio jazz',

  // Remix variations
  'remix': 'remix',
  'remix-jazz': 'remix jazz',
  'remixjazz': 'remix jazz',
  'remix jazz': 'remix jazz',

  // Cover variations
  'cover': 'cover',
  'cover-jazz': 'cover jazz',
  'coverjazz': 'cover jazz',
  'cover jazz': 'cover jazz',

  // Original variations
  'original': 'original',
  'original-jazz': 'original jazz',
  'originaljazz': 'original jazz',
  'original jazz': 'original jazz',

  // Mashup variations
  'mashup': 'mashup',
  'mashup-jazz': 'mashup jazz',
  'mashupjazz': 'mashup jazz',
  'mashup jazz': 'mashup jazz',

  // Beats variations
  'beats': 'beats',
  'beats-jazz': 'beats jazz',
  'beatsjazz': 'beats jazz',
  'beats jazz': 'beats jazz',

  // Bass variations
  'bass': 'bass',
  'bass-jazz': 'bass jazz',
  'bassjazz': 'bass jazz',
  'bass jazz': 'bass jazz',

  // Drum variations
  'drum': 'drum',
  'drum-jazz': 'drum jazz',
  'drumjazz': 'drum jazz',
  'drum jazz': 'drum jazz',

  // Percussion variations
  'percussion': 'percussion',
  'percussion-jazz': 'percussion jazz',
  'percussionjazz': 'percussion jazz',
  'percussion jazz': 'percussion jazz',

  // Strings variations
  'strings': 'strings',
  'strings-jazz': 'strings jazz',
  'stringsjazz': 'strings jazz',
  'strings jazz': 'strings jazz',

  // Brass variations
  'brass': 'brass',
  'brass-jazz': 'brass jazz',
  'brassjazz': 'brass jazz',
  'brass jazz': 'brass jazz',

  // Woodwind variations
  'woodwind': 'woodwind',
  'woodwind-jazz': 'woodwind jazz',
  'woodwindjazz': 'woodwind jazz',
  'woodwind jazz': 'woodwind jazz',

  // Synthesizer variations
  'synthesizer': 'synthesizer',
  'synthesizer-jazz': 'synthesizer jazz',
  'synthesizerjazz': 'synthesizer jazz',
  'synthesizer jazz': 'synthesizer jazz',

  // Digital variations
  'digital': 'digital',
  'digital-jazz': 'digital jazz',
  'digitaljazz': 'digital jazz',
  'digital jazz': 'digital jazz',

  // Analog variations
  'analog': 'analog',
  'analog-jazz': 'analog jazz',
  'analogjazz': 'analog jazz',
  'analog jazz': 'analog jazz',

  // Lo-fi variations
  'lofi': 'lo-fi',
  'lo-fi': 'lo-fi',
  'lofi-jazz': 'lo-fi jazz',
  'lofijazz': 'lo-fi jazz',
  'lo-fi jazz': 'lo-fi jazz',

  // Hi-fi variations
  'hifi': 'hi-fi',
  'hi-fi': 'hi-fi',
  'hifi-jazz': 'hi-fi jazz',
  'hifijazz': 'hi-fi jazz',
  'hi-fi jazz': 'hi-fi jazz',

  // Avant-garde variations
  'avantgarde': 'avant-garde',
  'avant-garde': 'avant-garde',
  'avantgarde-jazz': 'avant-garde jazz',
  'avantgardejazz': 'avant-garde jazz',
  'avant-garde jazz': 'avant-garde jazz',

  // Progressive variations
  'progressive': 'progressive',
  'progressive-jazz': 'progressive jazz',
  'progressivejazz': 'progressive jazz',
  'progressive jazz': 'progressive jazz',

  // Psychedelic variations
  'psychedelic': 'psychedelic',
  'psychedelic-jazz': 'psychedelic jazz',
  'psychedelicjazz': 'psychedelic jazz',
  'psychedelic jazz': 'psychedelic jazz',

  // Spiritual variations
  'spiritual': 'spiritual',
  'spiritual-jazz': 'spiritual jazz',
  'spiritualjazz': 'spiritual jazz',
  'spiritual jazz': 'spiritual jazz',

  // Gospel variations
  'gospel': 'gospel',
  'gospel-jazz': 'gospel jazz',
  'gospeljazz': 'gospel jazz',
  'gospel jazz': 'gospel jazz',

  // Sacred variations
  'sacred': 'sacred',
  'sacred-jazz': 'sacred jazz',
  'sacredjazz': 'sacred jazz',
  'sacred jazz': 'sacred jazz',

  // Secular variations
  'secular': 'secular',
  'secular-jazz': 'secular jazz',
  'secularjazz': 'secular jazz',
  'secular jazz': 'secular jazz',

  // Urban variations
  'urban': 'urban',
  'urban-jazz': 'urban jazz',
  'urbanjazz': 'urban jazz',
  'urban jazz': 'urban jazz',

  // Rural variations
  'rural': 'rural',
  'rural-jazz': 'rural jazz',
  'ruraljazz': 'rural jazz',
  'rural jazz': 'rural jazz',

  // Indigenous variations
  'indigenous': 'indigenous',
  'indigenous-jazz': 'indigenous jazz',
  'indigenousjazz': 'indigenous jazz',
  'indigenous jazz': 'indigenous jazz',

  // Modern variations
  'modern': 'modern',
  'modern-jazz': 'modern jazz',
  'modernjazz': 'modern jazz',
  'modern jazz': 'modern jazz',

  // Contemporary variations
  'contemporary': 'contemporary',
  'contemporary-jazz': 'contemporary jazz',
  'contemporaryjazz': 'contemporary jazz',
  'contemporary jazz': 'contemporary jazz',

  // Classic variations
  'classic': 'classic',
  'classic-jazz': 'classic jazz',
  'classicjazz': 'classic jazz',
  'classic jazz': 'classic jazz',

  // Vintage variations
  'vintage': 'vintage',
  'vintage-jazz': 'vintage jazz',
  'vintagejazz': 'vintage jazz',
  'vintage jazz': 'vintage jazz',

  // Retro variations
  'retro': 'retro',
  'retro-jazz': 'retro jazz',
  'retrojazz': 'retro jazz',
  'retro jazz': 'retro jazz',

  // Future variations
  'future': 'future',
  'future-jazz': 'future jazz',
  'futurejazz': 'future jazz',
  'future jazz': 'future jazz',

  // Nu variations
  'nu': 'nu',
  'nu-jazz': 'nu jazz',
  'nujazz': 'nu jazz',
  'nu jazz': 'nu jazz',

  // Neo variations
  'neo': 'neo',
  'neo-jazz': 'neo jazz',
  'neojazz': 'neo jazz',
  'neo jazz': 'neo jazz',

  // Post variations
  'post': 'post',
  'post-jazz': 'post jazz',
  'postjazz': 'post jazz',
  'post jazz': 'post jazz'
};

// Helper function to normalize a genre string
function normalizeGenre(genre) {
  return genre.toLowerCase()
    .replace(/[-_]/g, ' ')  // Replace hyphens and underscores with spaces
    .replace(/\s+/g, ' ')   // Normalize spaces
    .trim();                // Remove leading/trailing spaces
}

// Helper function to get the standard form of a genre
function getStandardGenre(genre) {
  const normalized = normalizeGenre(genre);
  return genreConsolidationMap[normalized] || normalized;
}

async function consolidateGenres(dryRun = true) {
  try {
    console.log(`Starting genre consolidation... ${dryRun ? '(DRY RUN)' : ''}`);

    // Initialize Cosmic client
    const cosmic = createBucketClient(COSMIC_CONFIG);

    // Stats object to track consolidation
    const stats = {
      processed: 0,
      consolidated: 0,
      errors: 0,
    };

    console.log('Fetching genres from Cosmic...\n');

    let skip = 0;
    const limit = 100;
    let totalProcessed = 0;

    while (true) {
      try {
        console.log(`Fetching batch (skip: ${skip}, limit: ${limit})...`);
        const response = await cosmic.objects
          .find({
            type: 'genres',
          })
          .props(['id', 'title', 'slug', 'metadata'])
          .limit(limit)
          .skip(skip)
          .depth(1)
          .status('published');

        if (!response.objects || response.objects.length === 0) {
          console.log('No more genres to process.');
          break;
        }

        const genres = response.objects;
        console.log(`Processing ${genres.length} genres...`);

        for (const genre of genres) {
          try {
            const title = genre.title;
            const standardGenre = getStandardGenre(title);

            if (standardGenre !== title) {
              console.log(`${dryRun ? 'Would consolidate' : 'Consolidating'} "${title}" to "${standardGenre}"`);
              stats.consolidated++;

              if (!dryRun) {
                // Check if the standard genre already exists
                const existingGenre = await cosmic.objects.findOne({
                  type: 'genres',
                  title: standardGenre
                });

                if (existingGenre) {
                  // If it exists, delete the duplicate
                  await cosmic.objects.delete(genre.id);
                } else {
                  // If it doesn't exist, update the current genre
                  await cosmic.objects.updateOne(genre.id, {
                    title: standardGenre,
                    slug: standardGenre.toLowerCase().replace(/\s+/g, '-')
                  });
                }
              }
            } else {
              console.log(`Keeping "${title}" as is`);
            }

            stats.processed++;
          } catch (genreError) {
            console.error(`Error processing genre "${genre.title}":`, genreError);
            stats.errors++;
          }
        }

        totalProcessed += genres.length;
        console.log(`\nProcessed ${totalProcessed} genres so far`);

        if (genres.length < limit) {
          console.log('Reached end of genres.');
          break;
        }

        skip += limit;
      } catch (batchError) {
        console.error('Error fetching batch:', batchError);
        stats.errors++;
        break;
      }
    }

    console.log('\nConsolidation completed:');
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

// Run the consolidation
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  consolidateGenres(!shouldApply)  // Run in non-dry-run mode if --apply is present
    .then(() => {
      if (shouldApply) {
        console.log('\nChanges have been applied successfully.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to run consolidation:', error);
      process.exit(1);
    });
} 