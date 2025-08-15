const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const axios = require("axios");
const fs = require("fs").promises;
const { createBucketClient } = require("@cosmicjs/sdk");

const config = {
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  downloadDir: path.join(__dirname, "downloads"),
};

// Validate configuration
if (!config.cosmic.bucketSlug || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration:");
  if (!config.cosmic.bucketSlug) console.error("- NEXT_PUBLIC_COSMIC_BUCKET_SLUG is not set");
  if (!config.cosmic.writeKey) console.error("- COSMIC_WRITE_KEY is not set");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

async function ensureDownloadDir() {
  try {
    await fs.access(config.downloadDir);
  } catch {
    await fs.mkdir(config.downloadDir, { recursive: true });
  }
}

async function fetchEpisodesFromCraft(afterDate, limit = 100) {
  try {
    console.log(`🔍 Fetching episodes from Craft CMS after ${afterDate}...`);

    const query = `
      query {
        entries(type: "episode", broadcastDate: ">${afterDate}", limit: ${limit}) {
          id
          title
          slug
          broadcastDate
          broadcastTime
          duration
          description
          thumbnail {
            url
            filename
            id
          }
          tracklist
          bodyText
          categories {
            id
            title
            slug
            groupId
          }
          locations {
            id
            title
            slug
          }
          hosts {
            id
            title
            slug
          }
          takeovers {
            id
            title
            slug
          }
          featuredOnHomepage
          player
          dateCreated
          dateUpdated
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
      timeout: 30000,
    });

    if (response.data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
      throw new Error(JSON.stringify(response.data.errors, null, 2));
    }

    const episodes = response.data.data.entries || [];
    console.log(`✅ Found ${episodes.length} episodes from Craft CMS`);

    return episodes;
  } catch (error) {
    console.error("❌ Failed to fetch episodes from Craft:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(response.data, null, 2));
    }
    return [];
  }
}

async function downloadImage(imageUrl, filename) {
  try {
    const filepath = path.join(config.downloadDir, filename);

    // Check if file already exists
    try {
      await fs.access(filepath);
      console.log(`   📁 Image already exists: ${filename}`);
      return filepath;
    } catch {
      // File doesn't exist, download it
    }

    console.log(`   📥 Downloading: ${filename}`);
    const response = await axios({
      url: imageUrl,
      method: "GET",
      responseType: "arraybuffer",
      timeout: 30000,
    });

    await fs.writeFile(filepath, response.data);
    console.log(`   ✅ Downloaded: ${filename}`);
    return filepath;
  } catch (error) {
    console.error(`   ❌ Failed to download ${filename}:`, error.message);
    return null;
  }
}

async function uploadImageToCosmic(filepath, filename, title) {
  try {
    console.log(`   🚀 Uploading to Cosmic: ${filename}`);

    const fileBuffer = await fs.readFile(filepath);

    // Detect image type from filename extension
    const ext = path.extname(filename).toLowerCase();
    let mimeType = "image/jpeg"; // default

    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".svg") mimeType = "image/svg+xml";

    // Create a file-like object for Cosmic SDK
    const file = {
      originalname: filename,
      buffer: fileBuffer,
    };

    const response = await cosmic.media.insertOne({
      media: file,
    });

    if (response && response.media) {
      console.log(`   ✅ Uploaded to Cosmic: ${response.media.original_name}`);
      return response.media;
    } else {
      console.error(`   ❌ Invalid response from Cosmic for ${filename}`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Failed to upload ${filename} to Cosmic:`, error.message);
    return null;
  }
}

async function getExistingCosmicMedia() {
  try {
    const mediaMap = new Map();
    let skip = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      console.log(`📋 Fetching existing media batch: skip=${skip}, limit=${limit}`);

      const response = await cosmic.media.find({
        skip,
        limit,
        props: "id,original_name,name,url,imgix_url",
      });

      if (!response || !response.media) {
        console.error("Invalid media response format:", response);
        break;
      }

      const mediaItems = response.media;
      console.log(`   Found ${mediaItems.length} media items in this batch`);

      mediaItems.forEach((item) => {
        if (item.original_name) {
          // Store by filename for matching (fallback)
          const filename = path.basename(item.original_name);
          mediaMap.set(filename.toLowerCase(), item);
          mediaMap.set(item.original_name, item);

          // Also store by the media item itself for reference
          if (item.id) {
            mediaMap.set(item.id, item);
          }
        }
      });

      if (mediaItems.length < limit) {
        hasMore = false;
      } else {
        skip += limit;
      }
    }

    console.log(`   Total existing media items: ${mediaMap.size}`);
    return mediaMap;
  } catch (error) {
    console.error("❌ Error fetching existing media:", error.message);
    return new Map();
  }
}

async function getCosmicGenres() {
  try {
    console.log("📋 Fetching existing genres from Cosmic...");

    const response = await cosmic.objects.find({
      type: "genres",
      status: "published",
      props: "id,slug,title",
    });

    const genres = response.objects || [];
    console.log(`✅ Found ${genres.length} genres in Cosmic`);

    return genres;
  } catch (error) {
    console.error("❌ Error fetching Cosmic genres:", error.message);
    return [];
  }
}

async function getCosmicLocations() {
  try {
    console.log("📋 Fetching existing locations from Cosmic...");

    const response = await cosmic.objects.find({
      type: "locations",
      status: "published",
      props: "id,slug,title",
    });

    const locations = response.objects || [];
    console.log(`✅ Found ${locations.length} locations in Cosmic`);

    return locations;
  } catch (error) {
    console.error("❌ Error fetching Cosmic locations:", error.message);
    return [];
  }
}

async function getCosmicRegularHosts() {
  try {
    console.log("📋 Fetching existing regular hosts from Cosmic...");

    const response = await cosmic.objects.find({
      type: "regular-hosts",
      status: "published",
      props: "id,slug,title",
    });

    const hosts = response.objects || [];
    console.log(`✅ Found ${hosts.length} regular hosts in Cosmic`);

    return hosts;
  } catch (error) {
    console.error("❌ Error fetching Cosmic hosts:", error.message);
    return [];
  }
}

async function getCosmicTakeovers() {
  try {
    console.log("📋 Fetching existing takeovers from Cosmic...");

    const response = await cosmic.objects.find({
      type: "takeovers",
      status: "published",
      props: "id,slug,title",
    });

    const takeovers = response.objects || [];
    console.log(`✅ Found ${takeovers.length} takeovers in Cosmic`);

    return takeovers;
  } catch (error) {
    console.error("❌ Error fetching Cosmic takeovers:", error.message);
    return [];
  }
}

async function findMatchingCosmicObject(items, craftItem, type) {
  if (!craftItem || !craftItem.slug) return null;

  const matching = items.find((item) => item.slug === craftItem.slug);
  if (matching) {
    console.log(`   ✅ Found matching ${type}: ${craftItem.title}`);
    return matching;
  }

  console.log(`   ⚠️ No matching ${type} found for: ${craftItem.title} (${craftItem.slug})`);
  return null;
}

async function createEpisodeInCosmic(episode, mediaItem) {
  try {
    console.log(`   🚀 Creating episode in Cosmic: ${episode.title}`);

    // Get reference objects
    const cosmicGenres = await getCosmicGenres();
    const cosmicLocations = await getCosmicLocations();
    const cosmicHosts = await getCosmicRegularHosts();
    const cosmicTakeovers = await getCosmicTakeovers();

    // Map categories to genres (filter by groupId for genres)
    const genres =
      episode.categories
        ?.filter((cat) => cat.groupId === 1) // Assuming groupId 1 is genres
        .map((cat) => findMatchingCosmicObject(cosmicGenres, cat, "genre"))
        .filter(Boolean) || [];

    // Map locations
    const locations = episode.locations?.map((loc) => findMatchingCosmicObject(cosmicLocations, loc, "location")).filter(Boolean) || [];

    // Map hosts
    const hosts = episode.hosts?.map((host) => findMatchingCosmicObject(cosmicHosts, host, "host")).filter(Boolean) || [];

    // Map takeovers
    const takeovers = episode.takeovers?.map((takeover) => findMatchingCosmicObject(cosmicTakeovers, takeover, "takeover")).filter(Boolean) || [];

    // Prepare episode data
    const episodeData = {
      title: episode.title,
      slug: episode.slug,
      type: "episode",
      metadata: {
        broadcast_date: episode.broadcastDate,
        body_text: episode.bodyText,
        genres: genres,
        locations: locations,
        regular_hosts: hosts,
        takeovers: takeovers,
        featured_on_homepage: episode.featuredOnHomepage || false,
        source: "migrated_from_craft",
        radiocult_synced: false,
      },
      thumbnail: mediaItem ? mediaItem.name : null,
    };

    // Only add fields if they have values
    if (episode.broadcastTime) {
      episodeData.metadata.broadcast_time = episode.broadcastTime;
    }

    if (episode.duration) {
      episodeData.metadata.duration = episode.duration;
    }

    if (episode.description) {
      episodeData.metadata.description = episode.description;
    }

    if (mediaItem) {
      // CRITICAL: Use mediaItem.name for both image and thumbnail
      // This is Cosmic's standard way of referencing media objects
      episodeData.metadata.image = mediaItem.name;
    }

    if (episode.player) {
      episodeData.metadata.player = episode.player;
    }

    if (episode.tracklist) {
      episodeData.metadata.tracklist = episode.tracklist;
    }

    console.log(`   📝 Episode data prepared:`, JSON.stringify(episodeData, null, 2));

    // Create the episode
    const result = await cosmic.objects.insertOne({
      ...episodeData,
      status: "published",
    });

    if (result && result.object) {
      console.log(`   ✅ Successfully created episode: ${result.object.title}`);
      return result.object;
    } else {
      console.error(`   ❌ Invalid response from Cosmic for ${episode.title}`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Error creating episode ${episode.title}:`, error.message);
    if (error.response) {
      console.error(`   📡 Response status:`, error.response.status);
      console.error(`   📡 Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function processEpisodes() {
  try {
    await ensureDownloadDir();

    // Get existing media to avoid re-uploading
    const existingMediaMap = await getExistingCosmicMedia();

    // Get episodes from Craft CMS after the last migrated date
    const lastMigratedDate = "2025-07-23T13:00:00+00:00";
    const episodes = await fetchEpisodesFromCraft(lastMigratedDate, 50); // Start with 50

    if (episodes.length === 0) {
      console.log("❌ No episodes found to process");
      return;
    }

    let processed = 0;
    let created = 0;
    let skipped = 0;

    for (const episode of episodes) {
      console.log(`\n🎯 Processing episode: ${episode.title} (${episode.slug})`);

      // Check if episode already exists in Cosmic
      try {
        const existingEpisode = await cosmic.objects.findOne({
          type: "episode",
          slug: episode.slug,
        });

        if (existingEpisode) {
          console.log(`   ⚠️ Episode already exists in Cosmic: ${episode.title}`);
          skipped++;
          continue;
        }
      } catch (error) {
        // Episode doesn't exist, continue
      }

      let mediaItem = null;

      // Handle thumbnail (array format in Craft)
      if (episode.thumbnail && Array.isArray(episode.thumbnail) && episode.thumbnail.length > 0) {
        const thumbnail = episode.thumbnail[0];

        if (thumbnail.url && thumbnail.filename) {
          // CRITICAL: Each episode should have its own unique image
          // We need to download and upload each image individually
          // Don't reuse downloaded files - each episode needs its own media item

          // Download the image for this specific episode
          const filepath = await downloadImage(thumbnail.url, thumbnail.filename);
          if (filepath) {
            // Upload to Cosmic - this creates a unique media item
            mediaItem = await uploadImageToCosmic(filepath, thumbnail.filename, episode.title);

            if (mediaItem) {
              console.log(`   📸 Successfully uploaded image for: ${episode.title}`);
            } else {
              console.log(`   ❌ Failed to upload image for: ${episode.title}`);
            }
          } else {
            console.log(`   ❌ Failed to download image for: ${episode.title}`);
          }
        }
      }

      // Create episode in Cosmic
      const success = await createEpisodeInCosmic(episode, mediaItem);
      if (success) {
        created++;
      }

      processed++;
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`   🎯 Total episodes: ${episodes.length}`);
    console.log(`   ✅ Created episodes: ${created}`);
    console.log(`   ⏭️ Skipped (already exist): ${skipped}`);
    console.log(`   📦 Total processed: ${processed}`);
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

async function main() {
  console.log("🎵 Starting episode migration process...");
  console.log("📁 Download directory:", config.downloadDir);

  try {
    await processEpisodes();
    console.log("\n🎉 Episode migration process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, processEpisodes };
