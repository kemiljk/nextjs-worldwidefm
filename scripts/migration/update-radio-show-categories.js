require("dotenv").config();

const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from .env.local first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Then load from .env if it exists
dotenv.config({ path: path.join(__dirname, ".env") });

const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "worldwidefm",
};

// Cosmic configuration
const COSMIC_CONFIG = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

// Log configuration (without sensitive data)
console.log("Using configuration:", {
  bucketSlug: COSMIC_CONFIG.bucketSlug,
  dbHost: dbConfig.host,
  dbName: dbConfig.database,
});

// Common music genres for validation
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
const takeoverTypes = new Set(["takeover", "showcase", "presents", "records", "recordings", "label", "studios", "productions", "radio", "show", "festival", "sessions"]);

// Common words for filtering
const commonWords = new Set(["the", "of", "and", "to", "in", "a", "an", "for", "with", "by", "at", "on", "from", "about", "into", "over", "after", "album", "week", "rundown", "top", "10"]);

const SHOW_TYPES = {
  ALBUM_OF_THE_WEEK: ["album of the week", "album-of-the-week"],
  ALBUM_RUNDOWN: ["album rundown", "album-rundown"],
  TETE_A_TETES: ["tete-a-tetes", "tête-à-têtes"],
  WORLDWIDE_FAMILY: ["worldwide family", "worldwide-family"],
  TOP_10: ["top 10", "top-10"],
  STUDIO_MONKEY_SHOULDER: ["studio monkey shoulder", "studio-monkey-shoulder"],
  RADIOMATIQUE: ["radiomatique", "aesop radiomatique"],
  BROWNSWOOD_BASEMENT: ["brownswood basement"],
  TEST_PRESS_CLUB: ["test press club"],
  WE_OUT_HERE: ["we out here"],
  RICCI_WEEKENDER: ["ricci weekender"],
  SOUNDBOKS: ["soundboks"],
  NURA_SOUND: ["nura sound"],
};

const LOCATIONS = [
  "miami",
  "taiwan",
  "nigeria",
  "uk",
  "usa",
  "sheffield",
  "london",
  "manchester",
  "bristol",
  "brighton",
  "leeds",
  "glasgow",
  "dublin",
  "berlin",
  "paris",
  "amsterdam",
  "tokyo",
  "seoul",
  "melbourne",
  "sydney",
  "cape town",
  "johannesburg",
  "lagos",
  "accra",
  "nairobi",
  "delhi",
  "mumbai",
  "bangalore",
  "shanghai",
  "beijing",
  "hong kong",
  "singapore",
  "kuala lumpur",
  "jakarta",
  "bangkok",
  "manila",
  "toronto",
  "montreal",
  "vancouver",
  "new york",
  "los angeles",
  "chicago",
  "detroit",
  "atlanta",
  "miami",
  "houston",
  "seattle",
  "portland",
  "san francisco",
  "mexico city",
  "são paulo",
  "rio de janeiro",
  "buenos aires",
  "santiago",
  "bogota",
  "lima",
  "caracas",
  "havana",
  "kingston",
  "port of spain",
];

// Helper function to normalize strings for comparison
function normalizeString(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper function to check if a string looks like a person's name
function isLikelyName(str) {
  // Skip common words and short strings
  if (commonWords.has(str.toLowerCase()) || str.length < 2) return false;

  // Check if it looks like a name (starts with capital letter and contains at least one letter)
  return /^[A-Z][a-zA-Z\s]*[a-zA-Z]$/.test(str);
}

// Helper function to check if a string is likely a location
function isLocation(str) {
  // Skip common words and short strings
  if (commonWords.has(str.toLowerCase()) || str.length < 2) return false;

  // Check if it matches any of our location patterns
  const locationPatterns = [/\b(london|paris|new\s*york|los\s*angeles|chicago|berlin|tokyo|seoul|beijing|rio|mumbai|taiwan|nigeria|uk|usa|miami|taichung|lagos|india)\b/i, /\b(africa|asia|europe|north\s*america|south\s*america|middle\s*east|south\s*china\s*sea)\b/i, /\b(little\s*haiti|basement\s*cafe)\b/i];

  return locationPatterns.some((pattern) => pattern.test(str));
}

// Helper function to check if a string is a music genre
function isGenre(str) {
  // Skip common words and short strings
  if (commonWords.has(str.toLowerCase()) || str.length < 2) return false;

  // Check if it matches any of our genre patterns
  const genrePatterns = [/\b(jazz|funk|soul|hip\s*hop|r&b|rock|pop|electronic|dance|house|techno|world\s*music)\b/i, /\b(latin|african|caribbean|indian|japanese|korean|chinese|brazilian)\b/i, /\b(experimental|avant\s*garde|contemporary|classical)\b/i, /\b(disco|boogie|funk|soul|r&b|hip\s*hop|jazz|electronic|dance|house|techno)\b/i, /\b(album\s*of\s*the\s*week)\b/i, /\b(spiritual\s*jazz|south\s*asian|tropicalia)\b/i];

  return genrePatterns.some((pattern) => pattern.test(str));
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

function extractHosts(title) {
  const hosts = new Set();

  // Match hosts after "with" or "w/"
  const hostSection = title.match(/(?:with|w\/)\s+([^.]+)(?:\.|$)/i);
  if (hostSection) {
    // Split on commas, ampersands, and "and"
    const hostList = hostSection[1]
      .split(/(?:,|\s+&\s+|\s+and\s+)/i)
      .map((host) => host.trim())
      .filter((host) => host.length > 0);

    for (const host of hostList) {
      // Clean up the host name
      const cleanHost = host
        .toLowerCase()
        .replace(/[.,]$/, "") // Remove trailing punctuation
        .trim();

      if (cleanHost && !LOCATIONS.includes(cleanHost)) {
        hosts.add(cleanHost);
      }
    }
  }

  return hosts;
}

function extractCategories(title, description) {
  const categories = {
    genres: new Set(),
    locations: new Set(),
    regular_hosts: new Set(),
    takeovers: new Set(),
  };

  try {
    const normalizedTitle = title.toLowerCase().trim();

    // Extract show type first
    if (normalizedTitle.includes(SHOW_TYPES.STUDIO_MONKEY_SHOULDER[0])) {
      categories.genres.add("studio-monkey-shoulder");
      // Extract location from SMS shows
      for (const location of LOCATIONS) {
        if (normalizedTitle.includes(location.toLowerCase())) {
          categories.locations.add(location.toLowerCase());
          break;
        }
      }
      // Extract hosts
      const hosts = extractHosts(title);
      for (const host of hosts) {
        categories.regular_hosts.add(host);
      }
    } else if (normalizedTitle.includes(SHOW_TYPES.ALBUM_OF_THE_WEEK[0])) {
      // Extract artist name after colon or dash
      const artistMatch = title.match(/(?::|[-–])\s*([^[(\n]+)/);
      if (artistMatch) {
        const artist = artistMatch[1]
          .trim()
          .replace(/[''"]/g, "") // Remove quotes
          .replace(/\s*\([^)]*\)/g, "") // Remove parentheses and their contents
          .toLowerCase();

        // Add the artist as a genre if it's a known genre
        if (commonGenres.has(artist)) {
          categories.genres.add(artist);
        }

        // Add the artist as a host
        categories.regular_hosts.add(artist);
      }
    } else if (normalizedTitle.includes(SHOW_TYPES.ALBUM_RUNDOWN[0])) {
      const artistMatch = title.match(/(?::|[-–])\s*([^[(\n]+)/);
      if (artistMatch) {
        const artist = artistMatch[1]
          .trim()
          .replace(/[''"]/g, "")
          .replace(/\s*\([^)]*\)/g, "")
          .toLowerCase();

        // Add the artist as a genre if it's a known genre
        if (commonGenres.has(artist)) {
          categories.genres.add(artist);
        }

        // Add the artist as a host
        categories.regular_hosts.add(artist);
      }
    } else if (normalizedTitle.includes(SHOW_TYPES.TETE_A_TETES[0]) || normalizedTitle.includes(SHOW_TYPES.TETE_A_TETES[1])) {
      categories.genres.add("tete-a-tetes");
    } else if (normalizedTitle.includes(SHOW_TYPES.WORLDWIDE_FAMILY[0])) {
      categories.genres.add("worldwide-family");
    } else if (normalizedTitle.includes(SHOW_TYPES.TOP_10[0])) {
      const topicMatch = title.match(/(?:\.{3}|…)\s*([^[(\n]+)/);
      if (topicMatch) {
        const topic = topicMatch[1].trim().toLowerCase();
        // Add the topic as a genre if it's a known genre
        if (commonGenres.has(topic)) {
          categories.genres.add(topic);
        }
      }
    } else if (normalizedTitle.includes(SHOW_TYPES.RADIOMATIQUE[0]) || normalizedTitle.includes(SHOW_TYPES.RADIOMATIQUE[1])) {
      categories.genres.add("radiomatique");
      // Extract artist for Radiomatique shows
      const artistMatch = title.match(/(?::|[-–])\s*([^[(\n]+)/);
      if (artistMatch) {
        const artist = artistMatch[1].trim().toLowerCase();
        categories.regular_hosts.add(artist);
      }
    } else if (normalizedTitle.includes(SHOW_TYPES.BROWNSWOOD_BASEMENT[0])) {
      categories.genres.add("brownswood-basement");
      // Extract hosts
      const hosts = extractHosts(title);
      for (const host of hosts) {
        categories.regular_hosts.add(host);
      }
    } else if (normalizedTitle.includes(SHOW_TYPES.TEST_PRESS_CLUB[0])) {
      categories.genres.add("test-press-club");
    } else if (normalizedTitle.includes(SHOW_TYPES.WE_OUT_HERE[0])) {
      categories.genres.add("we-out-here");
    } else if (normalizedTitle.includes(SHOW_TYPES.RICCI_WEEKENDER[0])) {
      categories.genres.add("ricci-weekender");
    } else if (normalizedTitle.includes(SHOW_TYPES.SOUNDBOKS[0])) {
      categories.genres.add("soundboks");
    } else if (normalizedTitle.includes(SHOW_TYPES.NURA_SOUND[0])) {
      categories.genres.add("nura-sound");
    }

    // Extract locations (only for non-SMS shows)
    if (!normalizedTitle.includes(SHOW_TYPES.STUDIO_MONKEY_SHOULDER[0])) {
      for (const location of LOCATIONS) {
        if (normalizedTitle.includes(location.toLowerCase())) {
          categories.locations.add(location.toLowerCase());
          break;
        }
      }
    }

    // Extract additional genres from description if available
    if (description) {
      const descWords = description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (commonGenres.has(word)) {
          categories.genres.add(word);
        }
      }
    }

    return categories;
  } catch (error) {
    console.error(`Error extracting categories from title "${title}":`, error);
    return categories;
  }
}

function generateSlug(title) {
  if (!title) return "";

  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

function areSlugsSimilar(slug1, slug2) {
  const distance = levenshteinDistance(slug1, slug2);
  const maxLength = Math.max(slug1.length, slug2.length);
  return distance <= Math.ceil(maxLength * 0.3); // Allow up to 30% difference
}

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // deletion
            dp[i][j - 1], // insertion
            dp[i - 1][j - 1] // substitution
          );
      }
    }
  }

  return dp[m][n];
}

// Helper function to normalize genre titles
function normalizeGenreTitle(title) {
  if (!title) return "";
  return title
    .split(/[-\s]+/) // Split on hyphens and spaces
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Title case each word
    .join(" "); // Join with spaces
}

// Helper function to create a new category in Cosmic
async function createCategory(cosmic, type, title) {
  // Normalize genre titles
  const normalizedTitle = type === "genres" ? normalizeGenreTitle(title) : title;
  const slug = generateSlug(title);
  try {
    console.log(`Creating category with data:`, {
      title: normalizedTitle,
      type,
      slug,
      status: "published",
    });

    const response = await cosmic.objects.insertOne({
      title: normalizedTitle,
      type,
      slug,
      status: "published",
    });

    if (!response || !response.object) {
      console.error("No object returned from insertOne");
      return null;
    }

    return response.object;
  } catch (error) {
    console.error(`Error creating ${type} "${normalizedTitle}":`, error);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    return null;
  }
}

// Helper function to get or create a category, using a cache map
async function getOrCreateCategory(cosmic, type, title, categoryMap) {
  if (!title) return null;

  // Normalize genre titles for comparison
  const normalizedTitle = type === "genres" ? normalizeGenreTitle(title) : title;

  // Check cache first
  if (categoryMap.has(normalizedTitle)) {
    return categoryMap.get(normalizedTitle);
  }

  try {
    // Try to find existing category
    const response = await cosmic.objects.find({
      type,
      props: "id,title,metadata",
      limit: 100,
    });

    if (!response || !response.objects) {
      console.log(`No ${type}s found in Cosmic`);
      return null;
    }

    // Try to find a match using various methods
    let category = null;
    const titleForComparison = normalizedTitle.toLowerCase().trim();
    const titleSlug = generateSlug(title);

    // First try exact match
    category = response.objects.find((cat) => cat.title.toLowerCase() === titleForComparison || generateSlug(cat.title) === titleSlug);

    // Then try fuzzy match
    if (!category) {
      category = response.objects.find((cat) => {
        const catSlug = generateSlug(cat.title);
        return areSlugsSimilar(titleSlug, catSlug);
      });
    }

    // Create if not found
    if (!category) {
      console.log(`Creating new ${type}: ${normalizedTitle}`);
      category = await createCategory(cosmic, type, title);
      if (!category) {
        console.error(`Failed to create ${type}: ${normalizedTitle}`);
        return null;
      }
      console.log(`Successfully created ${type}: ${normalizedTitle}`);
    }

    // Cache the result (even if null)
    categoryMap.set(normalizedTitle, category);
    return category;
  } catch (error) {
    console.error(`Error getting/creating ${type} "${normalizedTitle}":`, error);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    return null;
  }
}

// Helper function to find a show in Cosmic
async function findShowInCosmic(cosmic, mysqlShow) {
  const mysqlSlug = generateSlug(mysqlShow.title);

  try {
    // Get all shows from Cosmic
    const response = await cosmic.objects.find({
      type: "radio-shows",
      props: "id,title,metadata",
      limit: 1000,
    });

    if (!response || !response.objects) {
      console.log("No shows found in Cosmic");
      return null;
    }

    const cosmicShows = response.objects;

    // First try exact match
    const exactMatch = cosmicShows.find((show) => generateSlug(show.title) === mysqlSlug);
    if (exactMatch) return exactMatch;

    // Then try fuzzy match
    const fuzzyMatch = cosmicShows.find((show) => {
      const cosmicSlug = generateSlug(show.title);
      return mysqlSlug.includes(cosmicSlug) || cosmicSlug.includes(mysqlSlug) || areSlugsSimilar(mysqlSlug, cosmicSlug);
    });
    return fuzzyMatch;
  } catch (error) {
    console.error(`Error finding show "${mysqlShow.title}" in Cosmic:`, error);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    return null;
  }
}

// Create MySQL connection
async function createMysqlConnection() {
  return await mysql.createConnection(dbConfig);
}

// Helper function to find an image in Cosmic by original filename
async function findImageInCosmic(cosmic, originalFilename) {
  try {
    const response = await cosmic.objects.find({
      type: "images",
      props: "id,title,metadata",
      limit: 1000,
    });

    if (!response || !response.objects) {
      console.log("No images found in Cosmic");
      return null;
    }

    // Try to find exact match
    const exactMatch = response.objects.find((img) => img.metadata?.original_name === originalFilename);
    if (exactMatch) return exactMatch;

    // Try to find by filename without extension
    const filenameWithoutExt = originalFilename.replace(/\.[^/.]+$/, "");
    const fuzzyMatch = response.objects.find((img) => img.metadata?.original_name?.replace(/\.[^/.]+$/, "") === filenameWithoutExt);
    return fuzzyMatch;
  } catch (error) {
    console.error(`Error finding image "${originalFilename}" in Cosmic:`, error);
    return null;
  }
}

// Helper function to create a new radio show in Cosmic
async function createRadioShow(cosmic, episode, image) {
  try {
    console.log(`Creating radio show with data:`, {
      title: episode.title,
      type: "radio-shows",
      slug: generateSlug(episode.title),
      status: "published",
      metadata: {
        image: image ? image.id : "",
        description: episode.description || "",
        genres: [],
        locations: [],
        regular_hosts: [],
        takeovers: [],
      },
    });

    const response = await cosmic.objects.insertOne({
      title: episode.title,
      type: "radio-shows",
      slug: generateSlug(episode.title),
      status: "published",
      metadata: {
        image: image ? image.id : "",
        description: episode.description || "",
        genres: [],
        locations: [],
        regular_hosts: [],
        takeovers: [],
      },
    });

    if (!response || !response.object) {
      console.error("No object returned from insertOne");
      return null;
    }

    return response.object;
  } catch (error) {
    console.error(`Error creating radio show "${episode.title}":`, error);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    return null;
  }
}

// Helper function to normalize all existing genre tags in Cosmic
async function normalizeExistingGenres(cosmic) {
  try {
    console.log("Fetching all existing genres from Cosmic...");
    const response = await cosmic.objects.find({
      type: "genres",
      props: "id,title,metadata",
      limit: 1000,
    });

    if (!response || !response.objects) {
      console.log("No genres found in Cosmic");
      return;
    }

    console.log(`Found ${response.objects.length} genres to process`);

    for (const genre of response.objects) {
      const normalizedTitle = normalizeGenreTitle(genre.title);

      // Only update if the title needs normalization
      if (normalizedTitle !== genre.title) {
        console.log(`Normalizing genre: "${genre.title}" -> "${normalizedTitle}"`);

        try {
          await cosmic.objects.updateOne(genre.id, {
            title: normalizedTitle,
          });
          console.log(`Successfully normalized genre: "${genre.title}"`);
        } catch (error) {
          console.error(`Error normalizing genre "${genre.title}":`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error normalizing existing genres:", error);
  }
}

async function updateRadioShowCategories() {
  // Create Cosmic client with explicit configuration
  const cosmic = createBucketClient({
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  });

  // Log configuration (without sensitive data)
  console.log("Using configuration:", {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    dbHost: dbConfig.host,
    dbName: dbConfig.database,
  });

  // First normalize all existing genres
  await normalizeExistingGenres(cosmic);

  const mysql = await createMysqlConnection();

  // Cache maps for categories
  const genreMap = new Map();
  const locationMap = new Map();
  const hostMap = new Map();
  const takeoverMap = new Map();

  try {
    // Get all episodes from MySQL with their thumbnails
    const [episodes] = await mysql.query(`
      SELECT 
        e.id,
        MAX(c.title) as title,
        MAX(c.field_description) as description,
        MAX(s.slug) as slug,
        GROUP_CONCAT(DISTINCT r.fieldId, ':', r.targetId) as relations,
        GROUP_CONCAT(DISTINCT CASE WHEN r.fieldId = 4 THEN r.targetId END) as thumbnailId
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId
      WHERE e.sectionId = (SELECT id FROM craft_sections WHERE handle = 'episode')
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND s.siteId = 1
      GROUP BY e.id
    `);

    console.log(`Found ${episodes.length} episodes in MySQL`);

    // Process each episode
    for (const episode of episodes) {
      console.log("\nProcessing episode:", episode.title);

      try {
        // Find show in Cosmic
        let cosmicShow = await findShowInCosmic(cosmic, episode);

        // If show doesn't exist, create it
        if (!cosmicShow) {
          console.log(`Show "${episode.title}" not found in Cosmic, creating new show`);

          // Get thumbnail details if available
          let image = null;
          if (episode.thumbnailId) {
            const [thumbnailDetails] = await mysql.query(
              `
              SELECT a.id, a.filename
              FROM craft_assets a
              WHERE a.id = ?
            `,
              [episode.thumbnailId]
            );

            if (thumbnailDetails.length > 0) {
              const thumbnail = thumbnailDetails[0];
              image = await findImageInCosmic(cosmic, thumbnail.filename);
            }
          }

          // Create new show
          cosmicShow = await createRadioShow(cosmic, episode, image);
          if (!cosmicShow) {
            console.log(`Failed to create show "${episode.title}" in Cosmic`);
            continue;
          }
        }

        // Extract categories from relations
        const categories = {
          genres: new Set(),
          locations: new Set(),
          regular_hosts: new Set(),
          takeovers: new Set(),
        };

        if (episode.relations) {
          const relationParts = episode.relations.split(",");
          for (const relation of relationParts) {
            const [fieldId, targetId] = relation.split(":");

            // Skip thumbnail field
            if (fieldId === "4") continue;

            // Get category details
            const [categoryDetails] = await mysql.query(
              `
              SELECT c.id, cc.title, s.slug, cg.handle as groupHandle
              FROM craft_categories c
              JOIN craft_content cc ON c.id = cc.elementId
              JOIN craft_elements_sites s ON c.id = s.elementId
              JOIN craft_categorygroups cg ON c.groupId = cg.id
              WHERE c.id = ?
              AND s.siteId = 1
            `,
              [targetId]
            );

            if (categoryDetails.length > 0) {
              const category = categoryDetails[0];

              // Map categories based on group handle
              switch (category.groupHandle) {
                case "genres":
                  categories.genres.add(category.title);
                  break;
                case "locations":
                  categories.locations.add(category.title);
                  break;
                case "hosts":
                  categories.regular_hosts.add(category.title);
                  break;
                case "takeovers":
                  categories.takeovers.add(category.title);
                  break;
              }
            }
          }
        }

        console.log("Extracted categories:", categories);

        // Get or create categories
        const validGenres = await Promise.all(Array.from(categories.genres || []).map((g) => getOrCreateCategory(cosmic, "genres", g, genreMap))).then((results) => results.filter(Boolean));

        const validLocations = await Promise.all(Array.from(categories.locations || []).map((l) => getOrCreateCategory(cosmic, "locations", l, locationMap))).then((results) => results.filter(Boolean));

        const validHosts = await Promise.all(Array.from(categories.regular_hosts || []).map((h) => getOrCreateCategory(cosmic, "hosts", h, hostMap))).then((results) => results.filter(Boolean));

        const validTakeovers = await Promise.all(Array.from(categories.takeovers || []).map((t) => getOrCreateCategory(cosmic, "takeovers", t, takeoverMap))).then((results) => results.filter(Boolean));

        console.log("Valid categories:", {
          genres: validGenres,
          locations: validLocations,
          hosts: validHosts,
          takeovers: validTakeovers,
        });

        // Only update if we have valid categories
        if (validGenres.length > 0 || validLocations.length > 0 || validHosts.length > 0 || validTakeovers.length > 0) {
          // Update show in Cosmic, only including the categories we found
          const updatedShow = await cosmic.objects.updateOne(cosmicShow.id, {
            metadata: {
              genres: validGenres.map((g) => g.id),
              locations: validLocations.map((l) => l.id),
              regular_hosts: validHosts.map((h) => h.id),
              takeovers: validTakeovers.map((t) => t.id),
            },
          });

          if (!updatedShow || !updatedShow.object) {
            throw new Error("No object returned from updateOne");
          }

          console.log(`Successfully updated show "${episode.title}" with categories:`, {
            genres: validGenres.map((g) => g.title),
            locations: validLocations.map((l) => l.title),
            hosts: validHosts.map((h) => h.title),
            takeovers: validTakeovers.map((t) => t.title),
          });
        } else {
          console.log(`No valid categories found for show "${episode.title}"`);
        }
      } catch (error) {
        console.error(`Error processing show "${episode.title}":`, error);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mysql.end();
  }
}

// Run the update
updateRadioShowCategories();
