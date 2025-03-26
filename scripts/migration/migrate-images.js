const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const fs = require("fs");
const fsp = require("fs").promises;
const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");
const puppeteer = require("puppeteer");

// Configuration
const config = {
  mysql: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    database: process.env.DB_NAME || "worldwidefm",
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "worldwide-fm-production",
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
  baseUrl: "https://worldwidefm.net",
  downloadDir: path.join(__dirname, "downloads"),
  storageLocations: ["/Users/karlkoch/Developer/wwfm_craft/web/storage", "/Users/karlkoch/Developer/wwfm_craft/storage", "/Users/karlkoch/Developer/wwfm_craft/web/assets", "/Users/karlkoch/Developer/wwfm_craft/assets"],
  imageTypes: ["jpg", "jpeg", "png", "gif", "webp"],
};

// Validate configuration
if (!config.cosmic.bucketSlug || !config.cosmic.readKey || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration. Please check your .env file.");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function ensureDownloadDir() {
  try {
    await fsp.access(config.downloadDir);
  } catch {
    await fsp.mkdir(config.downloadDir, { recursive: true });
  }
}

async function getGraphQLSchema() {
  try {
    const query = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            fields {
              name
              type {
                name
                ofType {
                  name
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query },
    });

    if (response.data.errors) {
      console.error("Schema Errors:", JSON.stringify(response.data.errors, null, 2));
      return null;
    }

    return response.data.data.__schema;
  } catch (error) {
    console.error("Failed to fetch schema:", error.message);
    return null;
  }
}

async function fetchAssetsFromCraft() {
  try {
    let allAssets = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const query = `
        query {
          assets(limit: ${limit}, offset: ${offset}) {
            id
            url
            filename
          }
        }
      `;

      console.log(`\nFetching assets ${offset} to ${offset + limit}...`);
      const response = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query },
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

      console.log(`Fetched ${allAssets.length} assets so far...`);

      // If we got less than the limit, we've hit the end
      if (assets.length < limit) {
        hasMore = false;
      }
    }

    console.log(`\nFound ${allAssets.length} total assets`);
    return allAssets;
  } catch (error) {
    console.error("Failed to fetch assets from Craft:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

// Track processed images across runs
async function getProcessedImages() {
  const processedImagesFile = path.join(config.downloadDir, "processed_images.json");
  try {
    const data = await fsp.readFile(processedImagesFile, "utf8");
    return new Set(JSON.parse(data));
  } catch (error) {
    return new Set();
  }
}

async function saveProcessedImage(filename) {
  const processedImagesFile = path.join(config.downloadDir, "processed_images.json");
  try {
    const processedImages = await getProcessedImages();
    processedImages.add(filename);
    await fsp.writeFile(processedImagesFile, JSON.stringify(Array.from(processedImages)));
  } catch (error) {
    console.error("Error saving processed image:", error);
  }
}

function extractFilenameFromUrl(url) {
  try {
    // Remove query parameters
    const urlWithoutParams = url.split("?")[0];
    // Get the last part of the path
    const parts = urlWithoutParams.split("/");
    const filename = parts[parts.length - 1];
    return filename || "unknown.jpg";
  } catch (error) {
    console.log(`Error extracting filename from URL: ${error.message}`);
    return "unknown.jpg";
  }
}

async function findImageInStorage(filename, volumeHandle, volumeSettings) {
  try {
    // Parse volume settings to get the base path
    const settings = JSON.parse(volumeSettings);
    const basePath = settings.path || "";

    // Try different possible paths
    const possiblePaths = [path.join(config.storageLocations[0], basePath, filename), path.join(config.storageLocations[0], volumeHandle, filename), path.join(config.storageLocations[0], filename), path.join(config.storageLocations[1], basePath, filename), path.join(config.storageLocations[1], volumeHandle, filename), path.join(config.storageLocations[1], filename)];

    for (const filePath of possiblePaths) {
      try {
        await fsp.access(filePath);
        console.log(`  Found image in: ${filePath}`);
        return filePath;
      } catch (err) {
        continue;
      }
    }
  } catch (err) {
    console.log(`  Error checking paths: ${err.message}`);
  }
  return null;
}

async function downloadImage(url, filename) {
  try {
    // If no filename provided, extract it from the URL
    const actualFilename = filename || extractFilenameFromUrl(url);
    const filepath = path.join(config.downloadDir, actualFilename);

    // Check if file already exists
    try {
      await fsp.access(filepath);
      console.log(`  ↷ Skipping ${actualFilename} - already downloaded`);
      return filepath;
    } catch {
      // File doesn't exist, proceed with download
      console.log(`  Downloading image: ${actualFilename}`);
    }

    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 30000,
      maxRedirects: 5,
    });

    if (response.status !== 200) {
      console.log(`  ✗ Failed to download image: HTTP ${response.status}`);
      return null;
    }

    const writer = fs.createWriteStream(filepath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`  ✓ Downloaded successfully to ${filepath}`);
        resolve(filepath);
      });
      writer.on("error", (err) => {
        console.log(`  ✗ Error writing file: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    console.log(`  ✗ Error downloading image: ${error.message}`);
    return null;
  }
}

async function scrapeImages() {
  let browser;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    // Navigate to the page
    console.log("Navigating to website...");
    await page.goto(config.baseUrl, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for images to load
    await page.waitForSelector("img", { timeout: 10000 });

    // Get the page content after JavaScript execution
    const content = await page.content();
    const $ = cheerio.load(content);
    const images = new Set();

    // Find all image sources
    $("img").each((_, element) => {
      const src = $(element).attr("src");
      const dataSrc = $(element).attr("data-src");
      const srcset = $(element).attr("srcset");

      if (src) {
        try {
          const url = new URL(src, config.baseUrl).href;
          if (config.imageTypes.some((type) => url.toLowerCase().endsWith(type))) {
            images.add(url);
            console.log(`Found image: ${url}`);
          }
        } catch (e) {
          console.log(`Invalid URL: ${src}`);
        }
      }

      if (dataSrc) {
        try {
          const url = new URL(dataSrc, config.baseUrl).href;
          if (config.imageTypes.some((type) => url.toLowerCase().endsWith(type))) {
            images.add(url);
            console.log(`Found data-src image: ${url}`);
          }
        } catch (e) {
          console.log(`Invalid data-src URL: ${dataSrc}`);
        }
      }

      if (srcset) {
        const srcsetUrls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
        srcsetUrls.forEach((srcsetUrl) => {
          try {
            const url = new URL(srcsetUrl, config.baseUrl).href;
            if (config.imageTypes.some((type) => url.toLowerCase().endsWith(type))) {
              images.add(url);
              console.log(`Found srcset image: ${url}`);
            }
          } catch (e) {
            console.log(`Invalid srcset URL: ${srcsetUrl}`);
          }
        });
      }
    });

    // Find background images in style attributes
    $("[style*='background-image']").each((_, element) => {
      const style = $(element).attr("style");
      const matches = style.match(/url\(['"]?(.*?)['"]?\)/g);
      if (matches) {
        matches.forEach((match) => {
          const urlMatch = match.match(/url\(['"]?(.*?)['"]?\)/);
          if (urlMatch) {
            try {
              const url = new URL(urlMatch[1], config.baseUrl).href;
              if (config.imageTypes.some((type) => url.toLowerCase().endsWith(type))) {
                images.add(url);
                console.log(`Found background image: ${url}`);
              }
            } catch (e) {
              console.log(`Invalid background URL: ${urlMatch[1]}`);
            }
          }
        });
      }
    });

    // Look for background images in CSS classes
    $("[class*='bg-']").each((_, element) => {
      const classes = $(element).attr("class").split(" ");
      classes.forEach((cls) => {
        if (cls.startsWith("bg-")) {
          const style = $(element).css("background-image");
          if (style && style !== "none") {
            const urlMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
            if (urlMatch) {
              try {
                const url = new URL(urlMatch[1], config.baseUrl).href;
                if (config.imageTypes.some((type) => url.toLowerCase().endsWith(type))) {
                  images.add(url);
                  console.log(`Found CSS background image: ${url}`);
                }
              } catch (e) {
                console.log(`Invalid CSS background URL: ${urlMatch[1]}`);
              }
            }
          }
        }
      });
    });

    // Look for data attributes that might contain image URLs
    $("[data-background]").each((_, element) => {
      const background = $(element).attr("data-background");
      if (background) {
        try {
          const url = new URL(background, config.baseUrl).href;
          if (config.imageTypes.some((type) => url.toLowerCase().endsWith(type))) {
            images.add(url);
            console.log(`Found data-background image: ${url}`);
          }
        } catch (e) {
          console.log(`Invalid data-background URL: ${background}`);
        }
      }
    });

    // Also try to find images in the page source
    const imageRegex = /https:\/\/[^"'\s<>]+\.(jpg|jpeg|png|gif|webp)[^"'\s<>]*/g;
    const matches = content.match(imageRegex);
    if (matches) {
      matches.forEach((url) => {
        try {
          if (config.imageTypes.some((type) => url.toLowerCase().endsWith(type))) {
            images.add(url);
            console.log(`Found image in source: ${url}`);
          }
        } catch (e) {
          console.log(`Invalid URL in source: ${url}`);
        }
      });
    }

    return Array.from(images);
  } catch (error) {
    console.error("Failed to scrape images:", error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function getExistingCosmicMedia() {
  try {
    console.log("Fetching existing media from Cosmic...");
    const mediaMap = new Map();
    let skip = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await cosmic.media.find({
          limit,
          skip,
        });

        // If no media found, just return empty map
        if (!response || !response.media || response.media.length === 0) {
          console.log("No existing media found in Cosmic bucket");
          return mediaMap;
        }

        response.media.forEach((media) => {
          mediaMap.set(media.original_name, media.id);
        });

        skip += limit;
        hasMore = response.media.length === limit;
      } catch (error) {
        if (error.message.includes("No media found")) {
          console.log("No existing media found in Cosmic bucket");
          return mediaMap;
        }
        throw error;
      }
    }

    console.log(`Found ${mediaMap.size} existing media items in Cosmic`);
    return mediaMap;
  } catch (error) {
    console.error("Failed to fetch existing media:", error.message);
    return new Map();
  }
}

async function fetchEntriesFromCraft() {
  try {
    let allEntries = [];
    let offset = 0;
    const limit = 100;

    // First get total count
    const countQuery = `
      query {
        entries {
          id
        }
      }
    `;

    const countResponse = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: countQuery },
    });

    if (countResponse.data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(countResponse.data.errors, null, 2));
      throw new Error(JSON.stringify(countResponse.data.errors, null, 2));
    }

    const totalCount = countResponse.data.data.entries.length;
    console.log(`Total entries to process: ${totalCount}`);

    // Now fetch entries in batches
    while (offset < totalCount) {
      const query = `
        query {
          entries(limit: ${limit}, offset: ${offset}) {
            id
            title
            ... on articles_default_Entry {
              thumbnail {
                url
                filename
              }
            }
            ... on radioShow_default_Entry {
              thumbnail {
                url
                filename
              }
            }
          }
        }
      `;

      console.log(`\nFetching entries ${offset} to ${offset + limit} of ${totalCount}...`);
      const response = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query },
      });

      if (response.data.errors) {
        console.error("GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
        throw new Error(JSON.stringify(response.data.errors, null, 2));
      }

      const entries = response.data.data.entries;
      if (!entries || entries.length === 0) {
        console.log("No more entries found");
        break;
      }

      allEntries = [...allEntries, ...entries];
      offset += entries.length;

      console.log(`Fetched ${allEntries.length} of ${totalCount} total entries...`);
    }

    // Extract unique images and their associated entries
    const imageToEntriesMap = new Map();
    allEntries.forEach((entry) => {
      if (entry.thumbnail?.url && entry.thumbnail?.filename) {
        const key = entry.thumbnail.filename;
        if (!imageToEntriesMap.has(key)) {
          imageToEntriesMap.set(key, {
            url: entry.thumbnail.url,
            filename: entry.thumbnail.filename,
            entries: [],
          });
        }
        imageToEntriesMap.get(key).entries.push({
          id: entry.id,
          title: entry.title,
        });
      }
    });

    console.log(`Found ${imageToEntriesMap.size} unique images used in entries`);
    return Array.from(imageToEntriesMap.values());
  } catch (error) {
    console.error("Failed to fetch entries from Craft:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

async function uploadToCosmic(filepath, filename, existingMediaMap) {
  try {
    // Check if file already exists in Cosmic
    if (existingMediaMap.has(filename)) {
      console.log(`  → Using existing Cosmic media ID for ${filename}`);
      return { id: existingMediaMap.get(filename) };
    }

    console.log(`  Uploading ${filename} to Cosmic...`);
    const file = await fsp.readFile(filepath);
    const media = await cosmic.media.insertOne({
      media: {
        originalname: filename,
        buffer: file,
      },
    });
    console.log(`  ✓ Uploaded ${filename} successfully`);
    return media;
  } catch (error) {
    console.error(`  ✗ Failed to upload ${filename} to Cosmic:`, error.message);
    return null;
  }
}

async function updateCosmicObjects(filename, mediaId, entries) {
  console.log(`  Updating Cosmic objects for ${filename}...`);
  let updatedCount = 0;

  for (const entry of entries) {
    try {
      // Find the object in Cosmic
      const object = await cosmic.objects.findOne({
        type: entry.type,
        slug: entry.slug,
      });

      if (!object) {
        console.log(`  ⚠️  No matching object found for ${entry.type} with slug: ${entry.slug}`);
        continue;
      }

      // Update the object with the new media
      await cosmic.objects.update(object.id, {
        metadata: {
          ...object.metadata,
          thumbnail: {
            id: mediaId,
            imgix_url: `https://imgix.cosmicjs.com/${mediaId}`,
          },
        },
      });

      console.log(`  ✓ Updated ${entry.type} ${entry.slug} with media ${mediaId}`);
      updatedCount++;
    } catch (error) {
      console.error(`  ✗ Failed to update ${entry.type} ${entry.slug}:`, error.message);
    }
  }

  return updatedCount;
}

async function main() {
  console.log("\n=== Starting Image Migration ===\n");

  // Check download directory
  console.log("Checking download directory...");
  await ensureDownloadDir();
  console.log(`✓ Download directory ready at: ${config.downloadDir}\n`);

  // Get list of previously processed images
  const processedImages = await getProcessedImages();
  console.log(`Found ${processedImages.size} previously processed images\n`);

  // Fetch all assets from Craft
  console.log("Fetching assets from Craft...");
  const assets = await fetchAssetsFromCraft();
  console.log(`✓ Found ${assets.length} assets in Craft\n`);

  // Filter out already processed assets
  const unprocessedAssets = assets.filter((asset) => !processedImages.has(asset.filename));
  console.log(`${unprocessedAssets.length} assets remaining to process\n`);

  console.log("Starting image processing...\n");
  let processedCount = 0;
  let downloadedCount = 0;
  let uploadedCount = 0;
  let errorCount = 0;

  // Process each unprocessed asset
  for (const asset of unprocessedAssets) {
    processedCount++;
    console.log(`\nProcessing asset ${processedCount}/${unprocessedAssets.length}: ${asset.filename}`);
    console.log(`URL: ${asset.url}`);

    // Download the image
    const filepath = await downloadImage(asset.url, asset.filename);
    if (!filepath) {
      errorCount++;
      continue;
    }
    downloadedCount++;

    // Upload to Cosmic
    console.log("  Uploading to Cosmic...");
    const media = await uploadToCosmic(filepath, asset.filename, new Map());
    if (!media) {
      errorCount++;
      continue;
    }
    uploadedCount++;
    console.log("  ✓ Uploaded to Cosmic successfully");

    // Mark as processed
    await saveProcessedImage(asset.filename);
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Previously processed: ${processedImages.size}`);
  console.log(`New assets processed: ${processedCount}`);
  console.log(`Images downloaded: ${downloadedCount}`);
  console.log(`Images uploaded to Cosmic: ${uploadedCount}`);
  console.log(`Errors encountered: ${errorCount}`);
  console.log("\nImage migration complete!\n");
}

main().catch(console.error);
