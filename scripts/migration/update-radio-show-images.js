require("dotenv").config();

const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const axios = require("axios");

// Load environment variables from .env.local first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Then load from .env if it exists
dotenv.config({ path: path.join(__dirname, ".env") });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "worldwidefm",
};

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

async function getImageReferencesFromMySQL() {
  try {
    console.log("Connecting to MySQL database...");
    const connection = await mysql.createConnection(dbConfig);

    // Get episodes with their thumbnails
    const [episodes] = await connection.execute(`
      SELECT DISTINCT
        e.id,
        c.title,
        s.slug,
        a.filename as image,
        a.id as asset_id,
        r.fieldId,
        r.sourceId,
        r.targetId,
        e.sectionId,
        e.typeId,
        e.dateCreated
      FROM craft_entries e
      JOIN craft_elements_sites s ON e.id = s.elementId
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_relations r ON e.id = r.sourceId
      JOIN craft_assets a ON r.targetId = a.id
      WHERE e.sectionId = (SELECT id FROM craft_sections WHERE handle = 'episode')
      AND e.deletedWithEntryType IS NULL
      AND s.enabled = 1
      AND r.fieldId = 4
      ORDER BY e.dateCreated DESC
    `);

    await connection.end();

    console.log(`\nFound ${episodes.length} episodes with images`);
    return episodes.map((entry) => ({
      ...entry,
      type: "radio-shows",
    }));
  } catch (error) {
    console.error("Error getting image references:", error);
    return [];
  }
}

async function getCosmicMedia() {
  try {
    const mediaMap = new Map();
    let skip = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      console.log(`\nFetching media batch: skip=${skip}, limit=${limit}`);
      const response = await axios.get(`https://api.cosmicjs.com/v3/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/media`, {
        params: {
          read_key: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
          skip,
          limit,
          props: "id,original_name,name,url,imgix_url",
          depth: 1,
          sort: "-order",
        },
      });

      if (!response.data || !response.data.media) {
        console.error("Invalid media response format:", response.data);
        break;
      }

      const mediaItems = response.data.media;
      console.log(`Found ${mediaItems.length} media items in this batch`);

      mediaItems.forEach((item) => {
        if (item.original_name) {
          // Store both original and lowercase versions
          mediaMap.set(item.original_name.toLowerCase(), item);
          mediaMap.set(item.original_name, item);

          // Also try with the name field
          if (item.name) {
            mediaMap.set(item.name.toLowerCase(), item);
            mediaMap.set(item.name, item);
          }

          // Try with just the filename part
          const filename = item.original_name.split("/").pop();
          if (filename) {
            mediaMap.set(filename.toLowerCase(), item);
            mediaMap.set(filename, item);
          }
        }
      });

      skip += mediaItems.length;
      if (mediaItems.length < limit) hasMore = false;
    }

    console.log(`\nFound ${mediaMap.size} total media items in Cosmic`);
    return mediaMap;
  } catch (error) {
    console.error("Error getting Cosmic media:", error);
    return new Map();
  }
}

async function updateObjectWithMedia(object, mediaId) {
  try {
    if (!object || !object.id || !mediaId) {
      console.error("Missing required data for update:", { objectId: object?.id, mediaId });
      return false;
    }

    console.log(`Updating ${object.type} "${object.title}" with media ${mediaId}...`);

    await cosmic.objects.updateOne(object.id, {
      metadata: {
        image: mediaId,
      },
    });

    console.log(`✓ Updated ${object.type} "${object.title}" with media ${mediaId}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to update ${object.type} "${object.title}":`, error.message);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    return false;
  }
}

async function updateRadioShowImages() {
  try {
    // Get all episodes with images from MySQL
    const episodes = await getImageReferencesFromMySQL();
    if (episodes.length === 0) {
      console.log("No episodes found with images");
      return;
    }

    // Get all media from Cosmic
    const mediaMap = await getCosmicMedia();
    if (mediaMap.size === 0) {
      console.log("No media found in Cosmic");
      return;
    }

    // Process each episode
    let processedCount = 0;
    let updatedCount = 0;
    let noMediaCount = 0;

    for (const episode of episodes) {
      processedCount++;
      console.log(`\nProcessing episode ${processedCount}/${episodes.length}: ${episode.title}`);

      try {
        // Try to find matching media by filename
        let mediaItem = mediaMap.get(episode.image) || mediaMap.get(episode.image.toLowerCase());

        // If not found, try removing file extension
        if (!mediaItem) {
          const nameWithoutExt = episode.image.replace(/\.[^/.]+$/, "");
          mediaItem = mediaMap.get(nameWithoutExt) || mediaMap.get(nameWithoutExt.toLowerCase());
        }

        if (!mediaItem) {
          console.log(`⚠️  No matching media found in Cosmic for ${episode.image}`);
          noMediaCount++;
          continue;
        }

        console.log(`Found matching media: ${mediaItem.original_name} (${mediaItem.id})`);

        // Find the corresponding object in Cosmic
        const response = await cosmic.objects.find({
          type: "radio-shows",
          props: "id,title,slug",
          limit: 1000,
        });

        if (!response || !response.objects) {
          console.log("No radio shows found in Cosmic");
          continue;
        }

        // Try to find matching show by slug
        const matchingShow = response.objects.find((show) => show.slug === episode.slug);

        if (!matchingShow) {
          console.log(`⚠️  No matching show found in Cosmic for slug: ${episode.slug}`);
          continue;
        }

        // Update the show with the media
        const success = await updateObjectWithMedia(matchingShow, mediaItem.id);
        if (success) updatedCount++;
      } catch (error) {
        console.error(`Error processing episode ${episode.title}:`, error);
      }
    }

    console.log("\nSummary:");
    console.log(`Total episodes processed: ${processedCount}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`No matching media found: ${noMediaCount}`);
  } catch (error) {
    console.error("Error during update:", error);
  }
}

// Run the update
updateRadioShowImages();
