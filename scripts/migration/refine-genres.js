const path = require("path");
// Look for .env in the root directory
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");
const fs = require("fs");

// Validate environment variables
const requiredEnvVars = ["NEXT_PUBLIC_COSMIC_BUCKET_SLUG", "NEXT_PUBLIC_COSMIC_READ_KEY", "COSMIC_WRITE_KEY"];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}

const COSMIC_CONFIG = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

// --- START: Lists and Maps from categorize-tags.js and consolidate-genres.js ---

// List of common music genres for validation (from categorize-tags.js)
const commonGenres = new Set([
  "worldmusic",
  "afro",
  "latin",
  "brazilian",
  "jazz",
  "funk",
  "soul",
  "electronic",
  "house",
  "techno",
  "ambient",
  "experimental",
  "pop",
  "rock",
  "classical",
  "folk",
  "reggae",
  "dub",
  "hiphop",
  "rap",
  "rnb",
  "blues",
  "country",
  "metal",
  "punk",
  "indie",
  "alternative",
  "dance",
  "disco",
  "dubstep",
  "garage",
  "grime",
  "trap",
  "calypso",
  "samba",
  "bossanova",
  "salsa",
  "merengue",
  "cumbia",
  "reggaeton",
  "ska",
  "rocksteady",
  "roots",
  "worldbeat",
  "fusion",
  "tribal",
  "traditional",
  "instrumental",
  "vocal",
  "acapella",
  "acoustic",
  "electric",
  "live",
  "studio",
  "remix",
  "cover",
  "original",
  "mashup",
  "beats",
  "bass",
  "drum",
  "percussion",
  "strings",
  "brass",
  "woodwind",
  "synthesizer",
  "digital",
  "analog",
  "lofi",
  "hifi",
  "avantgarde",
  "progressive",
  "psychedelic",
  "spiritual",
  "gospel",
  "sacred",
  "secular",
  "urban",
  "rural",
  "indigenous",
  "modern",
  "contemporary",
  "classic",
  "vintage",
  "retro",
  "future",
  // Added some variations that might appear after basic normalization
  "r&b",
  "hip hop",
  "world music",
  "jazz funk",
  "soul jazz",
  "funk jazz",
  "latin jazz",
  "brazilian jazz",
  "afro jazz",
  "blues jazz",
  "rock jazz",
  "folk jazz",
  "classical jazz",
  "experimental jazz",
  "ambient jazz",
  "house jazz",
  "techno jazz",
  "pop jazz",
  "metal jazz",
  "punk jazz",
  "indie jazz",
  "alternative jazz",
  "dance jazz",
  "disco jazz",
  "dubstep jazz",
  "garage jazz",
  "grime jazz",
  "trap jazz",
  "calypso jazz",
  "samba jazz",
  "bossa nova",
  "salsa jazz",
  "merengue jazz",
  "cumbia jazz",
  "ska jazz",
  "rocksteady jazz",
  "roots jazz",
  "worldbeat jazz",
  "fusion jazz",
  "tribal jazz",
  "traditional jazz",
  "instrumental jazz",
  "vocal jazz",
  "acapella jazz",
  "acoustic jazz",
  "electric jazz",
  "live jazz",
  "studio jazz",
  "remix jazz",
  "cover jazz",
  "original jazz",
  "mashup jazz",
  "beats jazz",
  "bass jazz",
  "drum jazz",
  "percussion jazz",
  "strings jazz",
  "brass jazz",
  "woodwind jazz",
  "synthesizer jazz",
  "digital jazz",
  "analog jazz",
  "lo-fi",
  "hi-fi",
  "lo-fi jazz",
  "hi-fi jazz",
  "avant-garde",
  "avant-garde jazz",
  "progressive jazz",
  "psychedelic jazz",
  "spiritual jazz",
  "gospel jazz",
  "sacred jazz",
  "secular jazz",
  "urban jazz",
  "rural jazz",
  "indigenous jazz",
  "modern jazz",
  "contemporary jazz",
  "classic jazz",
  "vintage jazz",
  "retro jazz",
  "future jazz",
  "nu jazz",
  "neo jazz",
  "post jazz",
  // Added based on user feedback and further review
  "downtempo",
  "chillout",
  "trip hop",
  "lounge",
  "acid jazz",
  "broken beat",
  "uk garage",
  "2-step",
  "dub techno",
  "minimal techno",
  "tech house",
  "deep house",
  "progressive house",
  "electro house",
  "idm",
  "glitch",
  "glitch hop",
  "drum and bass",
  "jungle",
  "liquid funk",
  "neurofunk",
  "jump-up",
  "halftime",
  "footwork",
  "juke",
  "gabber",
  "hardcore",
  "hardstyle",
  "trance",
  "psytrance",
  "goa trance",
  "synthwave",
  "vaporwave",
  "seapunk",
  "witch house",
  "nu disco",
  "balearic beat",
  "italo disco",
  "afrobeat",
  "highlife",
  "soukous",
  "makossa",
  "mbaqanga",
  "juju music",
  "fuji music",
  "bhangra",
  "ghazal",
  "qawwali",
  "indian classical",
  "hindustani classical",
  "carnatic music",
  "gamelan",
  "dangdut",
  "k-pop",
  "j-pop",
  "c-pop",
  "trot",
  "enka",
  "baile funk",
  "kuduro",
  "gqom",
  "singeli",
  "funana",
  "kizomba",
  "zouk",
  "bluegrass",
  "cajun",
  "zydeco",
  "tejano",
  "honky-tonk",
  "western swing",
  "bebop",
  "hard bop",
  "cool jazz",
  "modal jazz",
  "free jazz",
  "swing music",
  "big band",
  "doo-wop",
  "surf rock",
  "garage rock",
  "psychedelic rock",
  "glam rock",
  "punk rock",
  "hardcore punk",
  "post-punk",
  "new wave",
  "gothic rock",
  "alternative rock",
  "indie rock",
  "grunge",
  "britpop",
  "shoegaze",
  "post-rock",
  "math rock",
  "noise rock",
  "industrial music",
  "ebm",
  "power electronics",
  "neofolk",
  "martial industrial",
  "dark ambient",
  "death industrial",
  "skweee",
  "wonky",
  "future bass",
  "future funk",
  "lofi hip hop",
]);

// List of common content types/formats (from categorize-tags.js)
const contentTypes = new Set(["interview", "podcast", "mix", "live", "session", "special", "series", "compilation", "playlist", "broadcast", "stream", "recording", "performance", "set", "radio show", "live set", "dj set", "mixtape", "album", "ep", "single", "remix"]);

// List of takeover types (from categorize-tags.js)
const takeoverTypes = new Set(["takeover", "showcase", "presents", "records", "recordings", "label", "studios", "productions", "radio", "festival", "sessions"]);

// Genre consolidation map (from consolidate-genres.js, extended slightly)
const genreConsolidationMap = {
  rnb: "r&b",
  "r and b": "r&b",
  "r & b": "r&b",
  randb: "r&b",
  "rhythm and blues": "r&b",
  hiphop: "hip hop",
  "hip-hop": "hip hop",
  electronica: "electronic",
  electro: "electronic",
  "jazz-funk": "jazz funk",
  jazzfunk: "jazz funk",
  worldmusic: "world music",
  world: "world music",
  "soul-jazz": "soul jazz",
  souljazz: "soul jazz",
  "funk-jazz": "funk jazz",
  funkjazz: "funk jazz",
  "latin-jazz": "latin jazz",
  latinjazz: "latin jazz",
  "brazilian-jazz": "brazilian jazz",
  brazilianjazz: "brazilian jazz",
  "afro-jazz": "afro jazz",
  afrojazz: "afro jazz",
  "blues-jazz": "blues jazz",
  bluesjazz: "blues jazz",
  "rock-jazz": "rock jazz",
  rockjazz: "rock jazz",
  "folk-jazz": "folk jazz",
  folkjazz: "folk jazz",
  "classical-jazz": "classical jazz",
  classicaljazz: "classical jazz",
  "experimental-jazz": "experimental jazz",
  experimentaljazz: "experimental jazz",
  "ambient-jazz": "ambient jazz",
  ambientjazz: "ambient jazz",
  "house-jazz": "house jazz",
  housejazz: "house jazz",
  "techno-jazz": "techno jazz",
  technojazz: "techno jazz",
  "pop-jazz": "pop jazz",
  popjazz: "pop jazz",
  "metal-jazz": "metal jazz",
  metaljazz: "metal jazz",
  "punk-jazz": "punk jazz",
  punkjazz: "punk jazz",
  "indie-jazz": "indie jazz",
  indiejazz: "indie jazz",
  "alternative-jazz": "alternative jazz",
  alternativejazz: "alternative jazz",
  "dance-jazz": "dance jazz",
  dancejazz: "dance jazz",
  "disco-jazz": "disco jazz",
  discojazz: "disco jazz",
  "dubstep-jazz": "dubstep jazz",
  dubstepjazz: "dubstep jazz",
  "garage-jazz": "garage jazz",
  garagejazz: "garage jazz",
  "grime-jazz": "grime jazz",
  grimejazz: "grime jazz",
  "trap-jazz": "trap jazz",
  trapjazz: "trap jazz",
  "calypso-jazz": "calypso jazz",
  calypsojazz: "calypso jazz",
  "samba-jazz": "samba jazz",
  sambajazz: "samba jazz",
  "bossa-nova": "bossa nova",
  bossanova: "bossa nova",
  "salsa-jazz": "salsa jazz",
  salsajazz: "salsa jazz",
  "merengue-jazz": "merengue jazz",
  merenguejazz: "merengue jazz",
  "cumbia-jazz": "cumbia jazz",
  cumbiajazz: "cumbia jazz",
  "ska-jazz": "ska jazz",
  skajazz: "ska jazz",
  "rocksteady-jazz": "rocksteady jazz",
  rocksteadyjazz: "rocksteady jazz",
  "roots-jazz": "roots jazz",
  rootsjazz: "roots jazz",
  "worldbeat-jazz": "worldbeat jazz",
  worldbeatjazz: "worldbeat jazz",
  "fusion-jazz": "fusion jazz",
  fusionjazz: "fusion jazz",
  "tribal-jazz": "tribal jazz",
  tribaljazz: "tribal jazz",
  "traditional-jazz": "traditional jazz",
  traditionaljazz: "traditional jazz",
  "instrumental-jazz": "instrumental jazz",
  instrumentaljazz: "instrumental jazz",
  "vocal-jazz": "vocal jazz",
  vocaljazz: "vocal jazz",
  "acapella-jazz": "acapella jazz",
  acapellajazz: "acapella jazz",
  "acoustic-jazz": "acoustic jazz",
  acousticjazz: "acoustic jazz",
  "electric-jazz": "electric jazz",
  electricjazz: "electric jazz",
  "live-jazz": "live jazz",
  livejazz: "live jazz",
  "studio-jazz": "studio jazz",
  studiojazz: "studio jazz",
  "remix-jazz": "remix jazz",
  remixjazz: "remix jazz",
  "cover-jazz": "cover jazz",
  coverjazz: "cover jazz",
  "original-jazz": "original jazz",
  originaljazz: "original jazz",
  "mashup-jazz": "mashup jazz",
  mashupjazz: "mashup jazz",
  "beats-jazz": "beats jazz",
  beatsjazz: "beats jazz",
  "bass-jazz": "bass jazz",
  bassjazz: "bass jazz",
  "drum-jazz": "drum jazz",
  drumjazz: "drum jazz",
  "percussion-jazz": "percussion jazz",
  percussionjazz: "percussion jazz",
  "strings-jazz": "strings jazz",
  stringsjazz: "strings jazz",
  "brass-jazz": "brass jazz",
  brassjazz: "brass jazz",
  "woodwind-jazz": "woodwind jazz",
  woodwindjazz: "woodwind jazz",
  "synthesizer-jazz": "synthesizer jazz",
  synthesizerjazz: "synthesizer jazz",
  "digital-jazz": "digital jazz",
  digitaljazz: "digital jazz",
  "analog-jazz": "analog jazz",
  analogjazz: "analog jazz",
  lofi: "lo-fi",
  "lofi-jazz": "lo-fi jazz",
  lofijazz: "lo-fi jazz",
  hifi: "hi-fi",
  "hifi-jazz": "hi-fi jazz",
  hifijazz: "hi-fi jazz",
  avantgarde: "avant-garde",
  "avantgarde-jazz": "avant-garde jazz",
  avantgardejazz: "avant-garde jazz",
  "progressive-jazz": "progressive jazz",
  progressivejazz: "progressive jazz",
  "psychedelic-jazz": "psychedelic jazz",
  psychedelicjazz: "psychedelic jazz",
  "spiritual-jazz": "spiritual jazz",
  spiritualjazz: "spiritual jazz",
  "gospel-jazz": "gospel jazz",
  gospeljazz: "gospel jazz",
  "sacred-jazz": "sacred jazz",
  sacredjazz: "sacred jazz",
  "secular-jazz": "secular jazz",
  secularjazz: "secular jazz",
  "urban-jazz": "urban jazz",
  urbanjazz: "urban jazz",
  "rural-jazz": "rural jazz",
  ruraljazz: "rural jazz",
  "indigenous-jazz": "indigenous jazz",
  indigenousjazz: "indigenous jazz",
  "modern-jazz": "modern jazz",
  modernjazz: "modern jazz",
  "contemporary-jazz": "contemporary jazz",
  contemporaryjazz: "contemporary jazz",
  "classic-jazz": "classic jazz",
  classicjazz: "classic jazz",
  "vintage-jazz": "vintage jazz",
  vintagejazz: "vintage jazz",
  "retro-jazz": "retro jazz",
  retrojazz: "retro jazz",
  "future-jazz": "future jazz",
  futurejazz: "future jazz",
  "nu-jazz": "nu jazz",
  nujazz: "nu jazz",
  "neo-jazz": "neo jazz",
  neojazz: "neo jazz",
  "post-jazz": "post jazz",
  postjazz: "post jazz",
};

// --- END: Lists and Maps ---

// --- START: Helper functions (from categorize-tags.js and consolidate-genres.js, and new ones) ---

function createSlug(title) {
  if (!title || typeof title !== "string") return "";
  return title
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars except hyphens
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

function normalizeRawTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title
    .toLowerCase()
    .replace(/[-_]/g, " ") // Replace hyphens and underscores with spaces for map lookup
    .replace(/\s+/g, " ") // Normalize spaces
    .trim(); // Remove leading/trailing spaces
}

function getStandardGenre(rawTitle) {
  const normalizedForMap = normalizeRawTitle(rawTitle);
  // Return the mapping, or the map-normalized title if no specific mapping exists,
  // or the original raw title (lowercased, trimmed) if all else fails.
  return genreConsolidationMap[normalizedForMap] || normalizedForMap || rawTitle.toLowerCase().trim();
}

function isGenre(title) {
  // from categorize-tags.js, adapted for normalized titles
  const normalized = normalizeRawTitle(title); // Ensure consistent normalization for checking commonGenres

  // Check for compound genres (e.g., "jazz funk", "electronic soul")
  const words = normalized.split(" ");
  if (words.length > 1) {
    // If every word is a known genre, it's a genre (e.g. "jazz funk soul")
    if (words.every((word) => commonGenres.has(word))) return true;
    // If at least one word is a known genre and it's a short phrase, might be a subgenre.
    // This needs careful tuning if we want to be more precise.
    // For now, if the whole normalized string is in commonGenres, it's simpler.
  }
  return commonGenres.has(normalized);
}

function isLikelyLocation(title) {
  // from categorize-tags.js
  const locationIndicators = [
    "chicago",
    "london",
    "paris",
    "berlin",
    "tokyo",
    "new york",
    "la ",
    "los angeles",
    "miami",
    "detroit",
    "atlanta",
    "seattle",
    "portland",
    "boston",
    "amsterdam",
    "africa",
    "asia",
    "europe",
    "america",
    "australia",
    "brazil",
    "japan",
    "china",
    "india",
    "russia",
    "mexico",
    "canada",
    "spain",
    "france",
    "germany",
    "italy",
    "uk",
    "usa",
    "united states",
    "united kingdom",
    "south",
    "north",
    "east",
    "west",
    "central",
    "pacific",
    "atlantic",
    "caribbean",
    "mediterranean",
    "scandinavian",
    "nordic",
    "asian",
    "african",
    "european",
    "american",
    "australian",
    "middle east",
    "eastern",
    "western",
    "northern",
    "southern",
  ];
  const normalizedTitle = title.toLowerCase();
  return locationIndicators.some((location) => normalizedTitle.includes(location));
}

function isLikelyName(title) {
  // from categorize-tags.js
  if (isLikelyLocation(title) || isGenre(title)) {
    return false;
  }
  const nonNameIndicators = [
    "records",
    "radio",
    "fm",
    "music",
    "sound",
    "audio",
    "studio",
    "production",
    "entertainment",
    "worldwide",
    "global",
    "international",
    "beats",
    "band",
    "orchestra",
    "ensemble",
    "quartet",
    "trio",
    "duo",
    "group",
    "collective",
    "label",
    "recordings",
    "presents",
    "productions",
    "showcase",
    "festival",
    "concert",
    "live",
    "session",
    "mix",
    "remix",
    "edit",
    "version",
    "vol",
    "volume",
    "part",
    "episode",
    "series",
    "collection",
    "compilation",
    "various",
    "artist",
    "artists",
    "featuring",
    "feat",
    "ft",
    "with",
    "and",
    "the",
    "by",
    "in",
    "on",
    "at",
    "from",
    "to",
    "of",
  ];
  const normalizedTitle = title.toLowerCase();
  if (nonNameIndicators.some((indicator) => normalizedTitle.includes(indicator))) {
    return false;
  }
  const words = normalizedTitle.split(" ");
  return words.length >= 1 && words.length <= 3 && !commonGenres.has(normalizedTitle);
}

function isContentType(title) {
  // from categorize-tags.js
  const normalized = title.toLowerCase().replace(/-/g, " ");
  return contentTypes.has(normalized) || Array.from(contentTypes).some((type) => normalized.includes(type) || type.includes(normalized));
}

function isTakeoverType(title) {
  // from categorize-tags.js
  const normalized = title.toLowerCase().replace(/-/g, " ");
  return takeoverTypes.has(normalized) || Array.from(takeoverTypes).some((type) => normalized.includes(type) || type.includes(normalized));
}

function isLikelyOrganization(title) {
  // from categorize-tags.js
  const organizationIndicators = ["records", "recordings", "label", "music", "productions", "studios", "sound system", "collective", "ensemble", "orchestra", "band", "group", "trio", "quartet", "quintet", "foundation", "institute", "society", "association", "club", "venue", "festival", "radio", "fm", "broadcast"];
  const normalized = title.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  return organizationIndicators.some((indicator) => normalized.includes(indicator) || normalized.endsWith(" records") || normalized.endsWith(" recordings") || normalized.endsWith(" productions") || normalized.endsWith(" studios") || normalized.endsWith(" music") || normalized.endsWith(" sound"));
}

// --- END: Helper functions ---

async function refineGenres(dryRun = true) {
  try {
    console.log(`Starting genre refinement... ${dryRun ? "(DRY RUN)" : ""}`);
    const cosmic = createBucketClient(COSMIC_CONFIG);

    const stats = {
      totalProcessed: 0,
      normalized: 0,
      duplicatesDeleted: 0,
      updatedToGenre: 0, // Item confirmed/changed to genre type and title/slug updated
      keptAsGenreUnchanged: 0, // Item confirmed as genre, no title/slug changes
      candidatesForLLM: 0,
      errors: 0,
    };

    // Map to store { normalized_lowercase_title -> { id: string, slug: string, originalTitle: string, type: string (genre or newType) } }
    // This helps detect duplicates based on the *final* normalized title.
    const handledNormalizedTitles = new Map();
    const genresForLLMReview = new Set();

    let skip = 0;
    const limit = 100; // Process in batches

    while (true) {
      console.log(`\nFetching batch of items (genres or regular-hosts) (skip: ${skip}, limit: ${limit})...`);
      let response;
      try {
        response = await cosmic.objects
          .find({
            $or: [{ type: "genres" }, { type: "regular-hosts" }],
          })
          .props(["id", "title", "slug", "metadata", "type"])
          .limit(limit)
          .skip(skip)
          .depth(1)
          .status("any");
      } catch (fetchError) {
        console.error("Error fetching batch:", fetchError);
        stats.errors++;
        // Decide if to break or retry, for now break.
        break;
      }

      if (!response || !response.objects || response.objects.length === 0) {
        console.log("No more items to process in this batch or altogether.");
        break;
      }

      const itemsInBatch = response.objects;
      console.log(`Processing ${itemsInBatch.length} items (genres/hosts) from batch...`);

      for (const item of itemsInBatch) {
        stats.totalProcessed++;
        const originalId = item.id;
        const originalTitle = item.title;
        const originalSlug = item.slug;
        const originalType = item.type;
        const originalMetadata = item.metadata || {};

        if (!originalTitle || typeof originalTitle !== "string" || originalTitle.trim() === "") {
          console.log(`${dryRun ? "Would delete" : "Deleting"} ${originalType} item with ID ${originalId} due to empty/invalid title.`);
          if (!dryRun) {
            try {
              await cosmic.objects.deleteOne(originalId);
              stats.duplicatesDeleted++;
            } catch (e) {
              console.error(`Error deleting ${originalType} item ${originalId} with empty title:`, e);
              stats.errors++;
            }
          } else {
            stats.duplicatesDeleted++;
          }
          continue;
        }

        const standardTitle = getStandardGenre(originalTitle);
        const standardTitleLower = standardTitle.toLowerCase();
        const newSlug = createSlug(standardTitle);

        if (normalizeRawTitle(originalTitle) !== standardTitleLower) {
          console.log(`Original ${originalType} "${originalTitle}" -> Normalized: "${standardTitle}"`);
          stats.normalized++;
        }

        if (handledNormalizedTitles.has(standardTitleLower)) {
          const existing = handledNormalizedTitles.get(standardTitleLower);
          console.log(`${dryRun ? "Would delete" : "Deleting"} duplicate ${originalType}: "${originalTitle}" (ID: ${originalId}) normalizes to "${standardTitle}", which is already handled by item ID ${existing.id} (as type ${existing.type}).`);
          if (!dryRun) {
            try {
              await cosmic.objects.deleteOne(originalId);
            } catch (e) {
              console.error(`Error deleting duplicate ${originalType} item ${originalId}:`, e);
              stats.errors++;
              continue;
            }
          }
          stats.duplicatesDeleted++;
          continue;
        }

        if (isGenre(standardTitle)) {
          // This item is confirmed to be a genre based on our commonGenres list.
          console.log(`"${standardTitle}" (from original ${originalType} "${originalTitle}") is in commonGenres list.`);

          // Mark as handled with type "genres"
          handledNormalizedTitles.set(standardTitleLower, { id: originalId, slug: newSlug, originalTitle: originalTitle, type: "genres" });

          if (originalType !== "genres" || originalTitle !== standardTitle || originalSlug !== newSlug) {
            console.log(`${dryRun ? "Would update/re-categorize to genre" : "Updating/Re-categorizing to genre"}: ID ${originalId} (original type ${originalType}, title "${originalTitle}") to type "genres" with title "${standardTitle}" and slug "${newSlug}".`);
            if (!dryRun) {
              try {
                if (originalType !== "genres") {
                  // Type change: Create new, delete old
                  await cosmic.objects.insertOne({
                    title: standardTitle,
                    type: "genres",
                    slug: newSlug,
                    metadata: originalMetadata,
                  });
                  await cosmic.objects.deleteOne(originalId);
                } else {
                  // Same type, just update title/slug
                  await cosmic.objects.updateOne(originalId, { title: standardTitle, slug: newSlug });
                }
                stats.updatedToGenre++;
              } catch (e) {
                console.error(`Error updating/re-categorizing item ${originalId} to genre:`, e);
                stats.errors++;
                if (e.message && e.message.includes("slug need to be unique")) {
                  console.log(`Slug conflict for genre "${standardTitle}" (slug "${newSlug}"). Original item ${originalId} will be deleted as duplicate.`);
                  try {
                    await cosmic.objects.deleteOne(originalId); // Delete the current one due to conflict
                    stats.duplicatesDeleted++;
                  } catch (delErr) {
                    console.error(`Failed to delete item ${originalId} after slug conflict:`, delErr);
                    // Already counted primary error
                  }
                }
                // No rollback of handledNormalizedTitles here as the aim was to make it a genre,
                // and if it failed due to slug conflict, the one with the slug already exists (or this one got deleted).
                continue;
              }
            } else {
              stats.updatedToGenre++; // Dry run
            }
          } else {
            console.log(`Item "${originalTitle}" (ID: ${originalId}) is already a standard genre. No changes needed.`);
            stats.keptAsGenreUnchanged++;
          }
        } else {
          // Not in commonGenres list. This item is a candidate for LLM review.
          console.log(`"${standardTitle}" (from original ${originalType} "${originalTitle}") is NOT in commonGenres. Adding to LLM review list.`);
          genresForLLMReview.add(standardTitle); // Add the *standardized* title
          stats.candidatesForLLM++;
          // We don't change its type or delete it here. We just log it for the LLM.
          // We still add it to handledNormalizedTitles to prevent its original form from being processed again if it appears as a duplicate later in the batch.
          // The type here is its original type, as we are not changing it in this script.
          handledNormalizedTitles.set(standardTitleLower, { id: originalId, slug: createSlug(originalTitle), originalTitle: originalTitle, type: originalType });
        }
      }

      if (itemsInBatch.length < limit) {
        console.log("Processed the last batch of items.");
        break; // Exit while loop
      }

      skip += limit;
    } // End while loop for pagination

    console.log("\n--- Refinement Complete ---");
    console.log("Stats:");
    console.log("- Total items (genres/hosts) processed: ", stats.totalProcessed);
    console.log("- Titles normalized: ", stats.normalized);
    console.log("- Duplicates deleted (based on normalized title): ", stats.duplicatesDeleted);
    console.log("- Confirmed/Re-categorized to 'genres' & updated (if needed): ", stats.updatedToGenre);
    console.log("- Confirmed as 'genres' and kept unchanged: ", stats.keptAsGenreUnchanged);
    console.log("- Candidates for LLM review: ", stats.candidatesForLLM);
    console.log("- Errors encountered: ", stats.errors);

    if (genresForLLMReview.size > 0) {
      const llmReviewFile = path.join(__dirname, "llm_review_candidates.txt");
      try {
        fs.writeFileSync(llmReviewFile, Array.from(genresForLLMReview).join("\n"));
        console.log(`\n- ${genresForLLMReview.size} unique genre titles saved to ${llmReviewFile} for LLM review.`);
      } catch (ioError) {
        console.error(`\nError writing LLM review candidates file: `, ioError);
      }
    }

    if (dryRun) {
      console.log("\nThis was a DRY RUN. No actual changes were made to your Cosmic JS data.");
      console.log("Run with the --apply flag to apply these changes.");
    } else {
      console.log("\nChanges have been APPLIED to your Cosmic JS data.");
    }
  } catch (error) {
    console.error("A fatal error occurred during the refinement process:", error);
    process.exit(1);
  }
}

// --- Main execution ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes("--apply");

  console.log("Cosmic Bucket Slug:", COSMIC_CONFIG.bucketSlug);
  console.log("Cosmic Read Key:", COSMIC_CONFIG.readKey ? "Provided" : "MISSING!");
  console.log("Cosmic Write Key:", COSMIC_CONFIG.writeKey ? "Provided (needed for --apply)" : "MISSING (needed for --apply)!");

  if (shouldApply && !COSMIC_CONFIG.writeKey) {
    console.error("COSMIC_WRITE_KEY is required to apply changes. Exiting.");
    process.exit(1);
  }

  refineGenres(!shouldApply) // dryRun is true if --apply is NOT present
    .then(() => {
      console.log("Script finished.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed with an unhandled error:", error);
      process.exit(1);
    });
}
