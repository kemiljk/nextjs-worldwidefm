const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const fs = require("fs");
const fsp = require("fs").promises;
const axios = require("axios");

// Configuration
const config = {
  mysql: {
    host: "localhost",
    user: "root",
    database: "worldwidefm",
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
  downloadDir: path.join(__dirname, "downloads"),
};

// Validate configuration
if (!config.cosmic.bucketSlug || !config.cosmic.readKey || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration. Please check your .env file.");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function ensureDownloadDir() {
  try {
    await fsp.access(config.downloadDir);
  } catch {
    await fsp.mkdir(config.downloadDir, { recursive: true });
  }
}

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

// Get all assets from Craft CMS using GraphQL API
async function fetchAllAssetsFromCraft() {
  try {
    let allAssets = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    console.log("🔍 Fetching all assets from Craft CMS API...");

    while (hasMore) {
      const query = `
        query {
          assets(limit: ${limit}, offset: ${offset}) {
            id
            url
            filename
            title
            kind
            size
          }
        }
      `;

      console.log(`   📥 Fetching assets ${offset} to ${offset + limit}...`);
      const response = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query },
        timeout: 30000, // 30 second timeout
      });

      if (response.data.errors) {
        console.error("GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
        throw new Error(JSON.stringify(response.data.errors, null, 2));
      }

      const assets = response.data.data.assets;
      if (!assets || assets.length === 0) {
        hasMore = false;
        break;
      }

      allAssets = [...allAssets, ...assets];
      offset += limit;

      console.log(`   📊 Fetched ${allAssets.length} assets so far...`);

      // If we got less than the limit, we've hit the end
      if (assets.length < limit) {
        hasMore = false;
      }

      // Add a small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`✅ Found ${allAssets.length} total assets from Craft CMS`);
    return allAssets;
  } catch (error) {
    console.error("❌ Failed to fetch assets from Craft:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

// Get collection categories (hosts) from the database
async function getHostsFromDatabase() {
  const connection = await getConnection();
  try {
    console.log("🔍 Fetching collection categories (hosts) from database...");

    // Get collection categories
    const [hosts] = await connection.execute(`
      SELECT 
        c.id,
        s.slug,
        cc.title
      FROM craft_categories c
      JOIN craft_content cc ON c.id = cc.elementId
      JOIN craft_elements el ON c.id = el.id
      JOIN craft_elements_sites es ON c.id = es.elementId
      JOIN craft_elements_sites s ON c.id = s.elementId
      WHERE c.groupId = (
        SELECT id FROM craft_categorygroups WHERE handle = 'collectionCategories'
      )
      AND el.dateDeleted IS NULL
      AND es.enabled = 1
      AND s.siteId = 1
      GROUP BY c.id, s.slug, cc.title
      ORDER BY cc.title
    `);

    console.log(`📊 Found ${hosts.length} hosts in database`);
    return hosts;
  } finally {
    await connection.end();
  }
}

// Create filename patterns for matching
function createFilenamePatterns(hostTitle, hostSlug) {
  const patterns = [];

  // Clean up the title for pattern matching
  const cleanTitle = hostTitle
    .replace(/[^\w\s-]/g, "") // Remove special characters except hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .toLowerCase();

  // Common patterns found in the filenames
  patterns.push(cleanTitle);
  patterns.push(hostSlug);

  // Handle specific cases
  if (hostTitle.includes("Gilles Peterson")) {
    patterns.push("gilles-peterson");
  }
  if (hostTitle.includes("Pedro Montenegro")) {
    patterns.push("pedro-montenegro", "no-problemo");
  }
  if (hostTitle.includes("WW ")) {
    const location = hostTitle.replace("WW ", "").toLowerCase().replace(/[^\w]/g, "-");
    patterns.push(location);
  }

  return patterns;
}

// Find matching asset for a host
function findMatchingAsset(host, assets) {
  const patterns = createFilenamePatterns(host.title, host.slug);

  for (const pattern of patterns) {
    const matchingAssets = assets.filter((asset) => asset.filename.toLowerCase().includes(pattern) && asset.kind === "image");

    if (matchingAssets.length > 0) {
      // Return the most recent asset (highest ID)
      return matchingAssets.sort((a, b) => parseInt(b.id) - parseInt(a.id))[0];
    }
  }

  return null;
}

// Get existing media from Cosmic to avoid duplicates
async function getExistingCosmicMedia() {
  try {
    console.log("📋 Fetching existing media from Cosmic...");
    const response = await axios.get(`https://api.cosmicjs.com/v3/buckets/${config.cosmic.bucketSlug}/media`, {
      params: {
        read_key: config.cosmic.readKey,
        limit: 1000,
        props: "id,name,original_name,imgix_url,url",
      },
    });

    const allMedia = response.data?.media || [];
    console.log(`📊 Found ${allMedia.length} existing media items in Cosmic`);

    // Create a map for quick lookup
    const mediaMap = new Map();
    allMedia.forEach((media) => {
      if (media.original_name) {
        mediaMap.set(media.original_name, media);
      }
      if (media.name) {
        mediaMap.set(media.name, media);
      }
    });

    return mediaMap;
  } catch (error) {
    console.error("❌ Error fetching existing media:", error.message);
    return new Map();
  }
}

// Find Cosmic host by slug
async function findCosmicHost(slug) {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "regular-hosts",
        slug: slug,
      })
      .props("id,slug,title,metadata");

    return response?.object || null;
  } catch (error) {
    console.error(`Error finding Cosmic host for ${slug}:`, error.message);
    return null;
  }
}

// Download image from URL
async function downloadImage(url, filename) {
  try {
    const filepath = path.join(config.downloadDir, filename);

    // Check if file already exists
    try {
      await fsp.access(filepath);
      console.log(`   ⏭️  Skipping ${filename} - already downloaded`);
      return filepath;
    } catch {
      // File doesn't exist, proceed with download
    }

    console.log(`   📥 Downloading: ${filename}`);
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 30000,
      maxRedirects: 5,
    });

    if (response.status !== 200) {
      console.log(`   ❌ Failed to download: HTTP ${response.status}`);
      return null;
    }

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`   ✅ Downloaded: ${filename}`);
        resolve(filepath);
      });
      writer.on("error", (err) => {
        console.log(`   ❌ Error writing file: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    console.log(`   ❌ Error downloading ${filename}: ${error.message}`);
    return null;
  }
}

// Upload image to Cosmic
async function uploadToCosmic(filepath, filename, existingMediaMap) {
  try {
    // Check if media already exists
    if (existingMediaMap.has(filename)) {
      const existingMedia = existingMediaMap.get(filename);
      console.log(`   ⏭️  Media already exists: ${filename} (${existingMedia.name})`);
      return existingMedia;
    }

    console.log(`   📤 Uploading to Cosmic: ${filename}`);

    const fileBuffer = await fsp.readFile(filepath);
    const mediaObject = await cosmic.media.insertOne({
      media: fileBuffer,
      folder: "host-images",
    });

    if (mediaObject?.media) {
      console.log(`   ✅ Uploaded successfully: ${mediaObject.media.name}`);
      return mediaObject.media;
    } else {
      console.log(`   ❌ Upload failed: No media object returned`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Error uploading ${filename}: ${error.message}`);
    return null;
  }
}

// Update Cosmic host with image
async function updateCosmicHost(hostId, mediaName) {
  try {
    console.log(`   🔗 Linking media to host...`);

    const updatedHost = await cosmic.objects.updateOne(hostId, {
      metadata: {
        image: mediaName,
      },
    });

    if (updatedHost?.object) {
      console.log(`   ✅ Successfully linked image to host`);
      return true;
    } else {
      console.log(`   ❌ Failed to update host`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error updating host: ${error.message}`);
    return false;
  }
}

// Main migration function
async function migrateHostImages() {
  const isDryRun = process.argv.includes("--dry-run");
  const isTest = process.argv.includes("--test");

  console.log("🖼️  Migrating Host Images by Filename Matching");
  console.log("===============================================");

  if (isDryRun) {
    console.log("Mode: DRY RUN");
  } else if (isTest) {
    console.log("Mode: TEST (10 hosts)");
  } else {
    console.log("Mode: FULL MIGRATION");
  }
  console.log("");

  try {
    // Ensure download directory exists
    await ensureDownloadDir();

    // Get existing media from Cosmic
    const existingMediaMap = await getExistingCosmicMedia();

    // Get all assets from Craft CMS
    const craftAssets = await fetchAllAssetsFromCraft();

    if (craftAssets.length === 0) {
      console.log("❌ No assets found from Craft CMS. Exiting.");
      return;
    }

    // Get hosts from database
    const hosts = await getHostsFromDatabase();
    console.log(`📋 Found ${hosts.length} hosts in database`);

    // Process hosts
    const hostsToProcess = isTest ? hosts.slice(0, 10) : hosts;
    console.log(`📋 Processing ${hostsToProcess.length} hosts`);
    console.log("");

    let stats = {
      processed: 0,
      matched: 0,
      downloaded: 0,
      uploaded: 0,
      linked: 0,
      skipped: 0,
      noMatch: 0,
      errors: 0,
    };

    for (const host of hostsToProcess) {
      console.log(`🔄 Processing: ${host.title} (${host.slug})`);
      stats.processed++;

      try {
        // Find matching asset by filename
        const matchingAsset = findMatchingAsset(host, craftAssets);
        if (!matchingAsset) {
          console.log(`   ❌ No matching asset found for: ${host.title}`);
          stats.noMatch++;
          continue;
        }

        console.log(`   ✅ Found matching asset: ${matchingAsset.filename}`);
        stats.matched++;

        // Find Cosmic host
        const cosmicHost = await findCosmicHost(host.slug);
        if (!cosmicHost) {
          console.log(`   ❌ Could not find Cosmic host for: ${host.title}`);
          stats.errors++;
          continue;
        }

        console.log(`   ✅ Found Cosmic host: ${cosmicHost.title} (${cosmicHost.slug})`);

        // Check if host already has an image
        if (cosmicHost.metadata?.image && cosmicHost.metadata.image !== "") {
          console.log(`   ⏭️  Host already has image, skipping...`);
          stats.skipped++;
          continue;
        }

        if (isDryRun) {
          console.log(`   🔍 Would download: ${matchingAsset.filename} from ${matchingAsset.url}`);
          console.log(`   🔍 Would upload to Cosmic and link to host`);
          continue;
        }

        // Download image from Craft CMS
        const downloadedPath = await downloadImage(matchingAsset.url, matchingAsset.filename);
        if (!downloadedPath) {
          console.log(`   ❌ Failed to download image, skipping...`);
          stats.errors++;
          continue;
        }
        stats.downloaded++;

        // Upload to Cosmic
        const mediaItem = await uploadToCosmic(downloadedPath, matchingAsset.filename, existingMediaMap);
        if (!mediaItem) {
          console.log(`   ❌ Failed to upload image, skipping...`);
          stats.errors++;
          continue;
        }
        stats.uploaded++;

        // Update host with image
        const success = await updateCosmicHost(cosmicHost.id, mediaItem.name);
        if (success) {
          stats.linked++;
        } else {
          stats.errors++;
        }

        // Add a small delay to avoid overwhelming the APIs
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(`   ❌ Error processing ${host.title}: ${error.message}`);
        stats.errors++;
      }

      console.log("");
    }

    // Print summary
    console.log("📊 Migration Summary:");
    console.log(`   📦 Hosts processed: ${stats.processed}`);
    console.log(`   🎯 Assets matched: ${stats.matched}`);
    console.log(`   📥 Images downloaded: ${stats.downloaded}`);
    console.log(`   📤 Images uploaded: ${stats.uploaded}`);
    console.log(`   🔗 Hosts linked: ${stats.linked}`);
    console.log(`   ⏭️  Hosts skipped (already have images): ${stats.skipped}`);
    console.log(`   ❌ No matching assets: ${stats.noMatch}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log("");

    if (isDryRun) {
      console.log("🔍 This was a dry run. Use --test to test with 10 hosts, or remove flags for full migration.");
    } else if (isTest) {
      console.log("🧪 This was a test run. Remove --test to process all hosts.");
    } else {
      console.log("🎉 Host image migration completed!");
    }
  } catch (error) {
    console.error("❌ Migration error:", error);
  }
}

// Run the migration
if (require.main === module) {
  migrateHostImages();
}

module.exports = { migrateHostImages };
