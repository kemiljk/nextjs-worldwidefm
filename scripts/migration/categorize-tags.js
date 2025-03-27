const path = require("path");
// Look for .env in the root directory
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const { createBucketClient } = require("@cosmicjs/sdk");

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

// List of common music genres for validation
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
  "experimental",
  "avantgarde",
  "progressive",
  "psychedelic",
  "spiritual",
  "gospel",
  "sacred",
  "secular",
  "urban",
  "rural",
  "tribal",
  "indigenous",
  "modern",
  "contemporary",
  "classic",
  "vintage",
  "retro",
  "future",
]);

// List of common content types/formats
const contentTypes = new Set(["interview", "podcast", "mix", "live", "session", "special", "series", "compilation", "playlist", "broadcast", "stream", "recording", "performance", "set", "radio show", "live set", "dj set", "mixtape", "album", "ep", "single", "remix"]);

// List of takeover types
const takeoverTypes = new Set(["takeover", "showcase", "presents", "records", "recordings", "label", "studios", "productions", "radio", , "festival", "sessions"]);

// Helper function to check if a string looks like a person's name
function isLikelyName(title) {
  // Skip if it's a likely location or genre
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

  // Check if contains any non-name indicators
  if (nonNameIndicators.some((indicator) => normalizedTitle.includes(indicator))) {
    return false;
  }

  // Check for likely name pattern (e.g., "First Last" or single word that's not a genre)
  const words = normalizedTitle.split(" ");
  return words.length >= 1 && words.length <= 3 && !commonGenres.has(normalizedTitle);
}

// Helper function to check if a string is likely a location
function isLikelyLocation(title) {
  // Common cities, countries, and regions
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

// Helper function to check if a string is a music genre
function isGenre(str) {
  // Convert to lowercase and remove special characters for checking
  const normalized = str
    .toLowerCase()
    .replace(/[-_]/g, " ") // Replace hyphens and underscores with spaces
    .replace(/\s+/g, " ") // Normalize spaces
    .trim(); // Remove leading/trailing spaces

  // Check for compound genres (e.g., "jazz funk", "electronic soul")
  const words = normalized.split(" ");
  if (words.length > 1) {
    const hasGenreWord = words.some((word) => commonGenres.has(word));
    const allWordsAreGenres = words.every((word) => commonGenres.has(word));
    return hasGenreWord || allWordsAreGenres;
  }

  return commonGenres.has(normalized) || Array.from(commonGenres).some((genre) => normalized.includes(genre) || genre.includes(normalized));
}

// Helper function to check if a string is a content type
function isContentType(str) {
  // Convert to lowercase and remove hyphens for checking
  const normalized = str.toLowerCase().replace(/-/g, " ");
  return contentTypes.has(normalized) || Array.from(contentTypes).some((type) => normalized.includes(type) || type.includes(normalized));
}

// Helper function to check if a string is a takeover type
function isTakeoverType(str) {
  const normalized = str.toLowerCase().replace(/-/g, " ");
  return takeoverTypes.has(normalized) || Array.from(takeoverTypes).some((type) => normalized.includes(type) || type.includes(normalized));
}

// Helper function to check if a string is likely a record label or music organization
function isLikelyOrganization(str) {
  const organizationIndicators = ["records", "recordings", "label", "music", "productions", "studios", "sound system", "collective", "ensemble", "orchestra", "band", "group", "trio", "quartet", "quintet", "foundation", "institute", "society", "association", "club", "venue", "festival", "radio", "fm", "broadcast"];

  const normalized = str.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

  return organizationIndicators.some((indicator) => normalized.includes(indicator) || normalized.endsWith(" records") || normalized.endsWith(" recordings") || normalized.endsWith(" productions") || normalized.endsWith(" studios") || normalized.endsWith(" music") || normalized.endsWith(" sound"));
}

async function categorizeGenres(dryRun = true) {
  try {
    console.log(`Starting genre categorization... ${dryRun ? "(DRY RUN)" : ""}`);

    // Initialize Cosmic client
    const cosmic = createBucketClient(COSMIC_CONFIG);

    console.log("Cosmic config:", {
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? process.env.NEXT_PUBLIC_COSMIC_READ_KEY.slice(0, 5) + "..." : undefined,
      writeKey: process.env.COSMIC_WRITE_KEY ? process.env.COSMIC_WRITE_KEY.slice(0, 5) + "..." : undefined,
    });

    // Stats object to track categorization
    const stats = {
      genres: 0,
      hosts: 0,
      locations: 0,
      types: 0,
      takeovers: 0,
      errors: 0,
    };

    console.log("Fetching genres from Cosmic...\n");

    let skip = 0;
    const limit = 100;
    let totalProcessed = 0;

    while (true) {
      try {
        console.log(`Fetching batch (skip: ${skip}, limit: ${limit})...`);
        const response = await cosmic.objects
          .find({
            type: "genres",
          })
          .props(["id", "title", "slug", "metadata"])
          .limit(limit)
          .skip(skip)
          .depth(1)
          .status("published");

        if (!response.objects || response.objects.length === 0) {
          console.log("No more genres to process.");
          break;
        }

        const genres = response.objects;
        console.log(`Processing ${genres.length} genres...`);

        for (const genre of genres) {
          try {
            const title = genre.title;
            let newType = null;
            let reason = "";

            if (isGenre(title)) {
              // Keep as genre
              console.log(`${dryRun ? "Would keep" : "Keeping"} "${title}" as genre`);
              stats.genres++;
              continue;
            } else if (isTakeoverType(title) || isLikelyOrganization(title)) {
              newType = "takeovers";
              reason = isLikelyOrganization(title) ? "is a record label/organization" : "is a takeover/showcase type";
              stats.takeovers++;
            } else if (isLikelyName(title)) {
              newType = "regular-hosts";
              reason = "appears to be a person's name";
              stats.hosts++;
            } else if (isLikelyLocation(title)) {
              newType = "locations";
              reason = "appears to be a location";
              stats.locations++;
            } else if (isContentType(title)) {
              newType = "types";
              reason = "appears to be a content type/format";
              stats.types++;
            } else {
              newType = "takeovers";
              reason = "does not match other categories";
              stats.takeovers++;
            }

            if (newType) {
              console.log(`${dryRun ? "Would move" : "Moving"} "${title}" to ${newType} (${reason})`);

              if (!dryRun) {
                // Create the new object in the appropriate category
                await cosmic.objects.create({
                  title: genre.title,
                  type: newType,
                  slug: genre.slug,
                  metadata: genre.metadata || {},
                });

                // Delete the original genre object
                await cosmic.objects.delete(genre.id);
              }
            }
          } catch (genreError) {
            console.error(`Error processing genre "${genre.title}":`, genreError);
            stats.errors++;
          }
        }

        totalProcessed += genres.length;
        console.log(`\nProcessed ${totalProcessed} genres so far`);

        if (genres.length < limit) {
          console.log("Reached end of genres.");
          break;
        }

        skip += limit;
      } catch (batchError) {
        console.error("Error fetching batch:", batchError);
        stats.errors++;
        break;
      }
    }

    console.log("\nCategorization completed:");
    console.log(`- Kept as genres: ${stats.genres}`);
    console.log(`- Moved to regular hosts: ${stats.hosts}`);
    console.log(`- Moved to locations: ${stats.locations}`);
    console.log(`- Moved to types: ${stats.types}`);
    console.log(`- Moved to takeovers: ${stats.takeovers}`);
    console.log(`- Errors encountered: ${stats.errors}`);

    if (dryRun) {
      console.log("\nThis was a dry run. No changes were made.");
      console.log("Run with --apply to apply changes.");
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the categorization
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes("--apply");
  categorizeGenres(!shouldApply) // Run in non-dry-run mode if --apply is present
    .then(() => {
      if (shouldApply) {
        console.log("\nChanges have been applied successfully.");
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to run categorization:", error);
      process.exit(1);
    });
}
