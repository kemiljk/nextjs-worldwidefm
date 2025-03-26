require("dotenv").config({ path: ".env.local" });
const path = require("path");
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const axios = require("axios");

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

// MySQL configuration
const mysqlConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
};

async function getImageReferencesFromMySQL() {
  try {
    console.log("Connecting to MySQL database...");
    const connection = await mysql.createConnection(mysqlConfig);

    // First, let's see what sections and fields we have for radio shows
    const [sections] = await connection.execute(`
      SELECT DISTINCT e.sectionId, e.typeId, r.fieldId, COUNT(*) as count
      FROM craft_entries e
      JOIN craft_relations r ON e.id = r.sourceId
      JOIN craft_assets a ON r.targetId = a.id
      WHERE e.deletedWithEntryType IS NULL
      GROUP BY e.sectionId, e.typeId, r.fieldId
      ORDER BY count DESC
    `);

    console.log("\nFound these section/type/field combinations:");
    sections.forEach((s) => {
      console.log(`Section ${s.sectionId}, Type ${s.typeId}, Field ${s.fieldId}: ${s.count} entries`);
    });

    // Get total count first
    const [countResult] = await connection.execute(`
      SELECT COUNT(DISTINCT e.id) as total
      FROM craft_entries e
      JOIN craft_elements_sites es ON e.id = es.elementId
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_relations r ON e.id = r.sourceId
      JOIN craft_assets a ON r.targetId = a.id
      WHERE e.deletedWithEntryType IS NULL
      AND es.enabled = 1
    `);

    const totalEntries = countResult[0].total;
    console.log(`\nTotal entries to process: ${totalEntries}`);

    let offset = 0;
    const limit = 100;
    let allEntries = [];

    while (offset < totalEntries) {
      // Get entries with images from all possible radio show sections
      // Using string interpolation instead of prepared statements for LIMIT/OFFSET
      const [episodeEntries] = await connection.execute(`
        SELECT DISTINCT
          e.id,
          c.title,
          es.slug,
          a.filename as image,
          a.id as asset_id,
          r.fieldId,
          r.sourceId,
          r.targetId,
          e.sectionId,
          e.typeId,
          e.dateCreated
        FROM craft_entries e
        JOIN craft_elements_sites es ON e.id = es.elementId
        JOIN craft_content c ON e.id = c.elementId
        JOIN craft_relations r ON e.id = r.sourceId
        JOIN craft_assets a ON r.targetId = a.id
        WHERE e.deletedWithEntryType IS NULL
        AND es.enabled = 1
        ORDER BY e.dateCreated DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      allEntries = [...allEntries, ...episodeEntries];
      console.log(`\nFetched entries ${offset + 1} to ${offset + episodeEntries.length} of ${totalEntries}`);

      if (offset === 0) {
        console.log("\nSample of first 5 entries:");
        episodeEntries.slice(0, 5).forEach((entry) => {
          console.log(`- "${entry.title}" (${entry.slug})`);
          console.log(`  Image: ${entry.image}`);
          console.log(`  Asset ID: ${entry.asset_id}`);
          console.log(`  Field ID: ${entry.fieldId}`);
          console.log(`  Section ID: ${entry.sectionId}`);
          console.log(`  Type ID: ${entry.typeId}`);
          console.log(`  Created: ${entry.dateCreated}`);
          console.log("  ---");
        });
      }

      offset += episodeEntries.length;
      if (episodeEntries.length < limit) break;
    }

    await connection.end();

    console.log(`\nFound ${allEntries.length} total entries with images`);
    return {
      radioShows: allEntries.map((entry) => ({
        ...entry,
        type: "radio-shows",
      })),
    };
  } catch (error) {
    console.error("Error fetching image references from MySQL:", error);
    return { radioShows: [] };
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

      // Log first few items for debugging
      if (skip === 0) {
        console.log("\nSample media items:");
        mediaItems.slice(0, 5).forEach((item) => {
          console.log(`- ${item.original_name} (${item.name})`);
        });
      }

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
        } else {
          console.warn("Media item missing original_name:", item);
        }
      });

      if (mediaItems.length < limit) {
        hasMore = false;
      } else {
        skip += limit;
      }
    }

    console.log(`\nTotal unique media items mapped: ${mediaMap.size}`);
    return mediaMap;
  } catch (error) {
    console.error("Error fetching media:", error.message);
    if (error.response) {
      console.error("Error response data:", error.response.data);
    }
    throw error;
  }
}

async function getCosmicObjects() {
  try {
    console.log("\nFetching radio shows from Cosmic...");
    const objects = {
      radioShows: [],
    };

    // Fetch radio shows with detailed logging
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await cosmic.objects.find({
        type: "radio-shows",
        limit: 100,
        skip,
        props: "id,title,slug,metadata,status",
      });

      if (!response || !response.objects || response.objects.length === 0) {
        break;
      }

      objects.radioShows.push(...response.objects);
      skip += response.objects.length;
      hasMore = response.objects.length === 100;
    }

    console.log(`\nFound ${objects.radioShows.length} radio shows in Cosmic`);
    console.log("\nSample of first 5 radio shows in Cosmic:");
    objects.radioShows.slice(0, 5).forEach((show) => {
      console.log(`- "${show.title}" (${show.slug})`);
      console.log(`  Status: ${show.status}`);
      console.log(`  Current image: ${show.metadata?.image || "None"}`);
      console.log("  ---");
    });

    return objects;
  } catch (error) {
    console.error("Error fetching objects from Cosmic:", error);
    return { radioShows: [] };
  }
}

async function updateObjectWithMedia(object, name, mediaId, originalName) {
  try {
    if (!object || !object.id || !mediaId || !originalName) {
      console.error("Missing required data for update:", { objectId: object?.id, mediaId, originalName });
      return false;
    }

    console.log(`Updating ${object.type} "${object.title}" with media ${mediaId} (${originalName})...`);

    await cosmic.objects.updateOne(object.id, {
      metadata: {
        image: name,
      },
      thumbnail: name,
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

// Test connection to Cosmic
async function testCosmicConnection() {
  try {
    console.log("Testing connection to Cosmic...");
    console.log("Bucket:", process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
    console.log("Read Key:", process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? "Present" : "Missing");
    console.log("Write Key:", process.env.COSMIC_WRITE_KEY ? "Present" : "Missing");

    // Test bucket access
    const bucketResponse = await cosmic.objects.find({
      type: "articles",
      limit: 1,
    });

    if (!bucketResponse || !bucketResponse.objects) {
      console.error("No objects found in bucket:", bucketResponse);
      return false;
    }

    console.log("Successfully connected to bucket");
    console.log("Found objects:", bucketResponse.objects.length);

    // Test media access with direct REST call
    const mediaResponse = await axios.get(`https://api.cosmicjs.com/v3/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/media`, {
      params: {
        skip: 0,
        limit: 10,
        read_key: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
        props: "url,imgix_url,name,original_name",
        depth: 1,
        sort: "-order",
      },
    });

    const data = mediaResponse.data;
    console.log("Raw media response:", JSON.stringify(data, null, 2));

    if (!data || !data.media || !Array.isArray(data.media)) {
      console.error("Invalid media response format:", data);
      return false;
    }

    console.log("Successfully retrieved media items");
    console.log("Found media items:", data.media.length);
    console.log("Total media items:", data.total);
    return true;
  } catch (err) {
    console.error("Error connecting to Cosmic:", err);
    if (err.response) {
      console.error("Error response data:", err.response.data);
    }
    return false;
  }
}

function extractBaseShowName(slug) {
  // Remove accents and special characters
  let base = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Remove common prefixes
  base = base.replace(/^(brownswood-basement-|worldwide-breakfast-|international-womens-day-|sound-system-sisters-|raul-monsalve-y-los-forajidos-takeover-|wewantsounds-takeover-|ghana-special-)/, "");

  // Remove everything after w/ or with
  base = base.split(/-w-|-with-/)[0];

  // Remove common suffixes
  base = base.replace(/-takeover$|-mix$|-session$|-in-conversation$/, "");

  // Remove numbers at end
  base = base.replace(/-\d+$/, "");

  return base;
}

function findBestMatchingSlug(mysqlSlug, cosmicSlugs) {
  const baseShowName = extractBaseShowName(mysqlSlug);
  console.log(`Base show name: ${baseShowName}`);

  // Try exact match first
  const exactMatch = cosmicSlugs.find((slug) => slug === mysqlSlug);
  if (exactMatch) {
    return exactMatch;
  }

  // Try base name match with stricter rules
  for (const cosmicSlug of cosmicSlugs) {
    const cosmicBase = extractBaseShowName(cosmicSlug);

    // Only match if the base names share at least 3 consecutive words
    const baseWords = baseShowName.split("-");
    const cosmicWords = cosmicBase.split("-");

    let hasMatch = false;
    for (let i = 0; i < baseWords.length - 2; i++) {
      for (let j = 0; j < cosmicWords.length - 2; j++) {
        if (baseWords[i] === cosmicWords[j] && baseWords[i + 1] === cosmicWords[j + 1] && baseWords[i + 2] === cosmicWords[j + 2]) {
          hasMatch = true;
          break;
        }
      }
    }

    // Special case for known show mappings
    const knownMappings = {
      "gilles-peterson": ["gilles-peterson", "brownswood"],
      wewantsounds: ["wewantsounds"],
      "we-out-here": ["we-out-here"],
      "no-problemo": ["no-problemo", "con-problemo"],
      "raul-monsalve": ["raul-monsalve", "forajidos"],
      tealeaves: ["tealeaves"],
      "first-light": ["first-light"],
    };

    for (const [key, values] of Object.entries(knownMappings)) {
      if (values.some((v) => baseShowName.includes(v)) && values.some((v) => cosmicBase.includes(v))) {
        hasMatch = true;
        break;
      }
    }

    if (hasMatch) {
      console.log(`Found base name match: MySQL base "${baseShowName}" matches Cosmic base "${cosmicBase}"`);
      return cosmicSlug;
    }
  }

  // No good match found
  console.log(`⚠️  No matching slug found in Cosmic for: ${mysqlSlug}`);
  console.log("Closest Cosmic slugs:");
  cosmicSlugs.slice(0, 3).forEach((slug) => {
    console.log(`  - ${slug} (base: ${extractBaseShowName(slug)})`);
  });
  return null;
}

async function linkImages() {
  try {
    // Get image references from MySQL
    const mysqlEntries = await getImageReferencesFromMySQL();
    console.log(`\nFound ${mysqlEntries.radioShows.length} radio shows with images in MySQL`);

    // Get media from Cosmic
    const mediaMap = await getCosmicMedia();
    console.log(`Found ${mediaMap.size} media items in Cosmic`);

    // Get objects from Cosmic
    const cosmicObjects = await getCosmicObjects();
    console.log(`Found ${cosmicObjects.radioShows.length} radio shows in Cosmic`);

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let noMatchCount = 0;
    let noMediaCount = 0;

    // Log all Cosmic slugs at the start
    console.log("\nAll Cosmic slugs:");
    const cosmicSlugs = cosmicObjects.radioShows.map((show) => show.slug);
    console.log(cosmicSlugs.join("\n"));

    // Process radio shows from MySQL
    const allEntries = mysqlEntries.radioShows;
    for (let i = 0; i < allEntries.length; i++) {
      processedCount++;
      const { id, title, slug, image, asset_id, fieldId, sectionId, typeId, dateCreated } = allEntries[i];
      console.log(`\nProcessing radio show ${i + 1}/${allEntries.length}: ${title}`);
      console.log(`MySQL slug: ${slug}`);

      try {
        // Try to find matching media by filename
        let mediaItem = mediaMap.get(image) || mediaMap.get(image.toLowerCase());

        // If not found, try removing file extension
        if (!mediaItem) {
          const nameWithoutExt = image.replace(/\.[^/.]+$/, "");
          mediaItem = mediaMap.get(nameWithoutExt) || mediaMap.get(nameWithoutExt.toLowerCase());
        }

        if (!mediaItem) {
          console.log(`⚠️  No matching media found in Cosmic for ${image}`);
          noMediaCount++;
          continue;
        }

        console.log(`Found matching media: ${mediaItem.original_name} (${mediaItem.id})`);

        // Find the corresponding object in Cosmic
        const matchingSlug = findBestMatchingSlug(slug, cosmicSlugs);
        if (matchingSlug) {
          console.log(`Found matching Cosmic slug: ${matchingSlug}`);
          const cosmicObject = cosmicObjects.radioShows.find((obj) => obj.slug === matchingSlug);

          // Update the object with the media
          const success = await updateObjectWithMedia(cosmicObject, mediaItem.name, mediaItem.id, mediaItem.original_name);
          if (success) {
            updatedCount++;
          } else {
            errorCount++;
          }
        } else {
          console.log(`⚠️  No matching slug found in Cosmic for: ${slug}`);
          console.log("Closest Cosmic slugs:");
          cosmicSlugs
            .filter((s) => s.length > 3) // Filter out very short slugs
            .sort((a, b) => {
              // Sort by similarity to MySQL slug
              const aBase = extractBaseShowName(a);
              const bBase = extractBaseShowName(b);
              const mysqlBase = extractBaseShowName(slug);

              const aSim = Math.max(aBase === mysqlBase ? 3 : 0, aBase.includes(mysqlBase) || mysqlBase.includes(aBase) ? 2 : 0, a.includes(slug) || slug.includes(a) ? 1 : 0);
              const bSim = Math.max(bBase === mysqlBase ? 3 : 0, bBase.includes(mysqlBase) || mysqlBase.includes(bBase) ? 2 : 0, b.includes(slug) || slug.includes(b) ? 1 : 0);
              return bSim - aSim;
            })
            .slice(0, 3)
            .forEach((s) => console.log(`  - ${s} (base: ${extractBaseShowName(s)})`));
          noMatchCount++;
        }
      } catch (err) {
        console.error(`❌ Error processing entry:`, err);
        errorCount++;
      }
    }

    console.log("\n=== Radio Shows Linking Summary ===");
    console.log(`Total radio shows processed: ${processedCount}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`No matching object in Cosmic: ${noMatchCount}`);
    console.log(`No matching media found: ${noMediaCount}`);
    console.log(`Other errors: ${errorCount}`);
    console.log("\nRadio shows linking complete!");
  } catch (err) {
    console.error("Error in linkImages:", err);
  }
}

async function main() {
  try {
    // First test the connection
    const connected = await testCosmicConnection();
    if (!connected) {
      console.error("Failed to connect to Cosmic. Please check your credentials and try again.");
      return;
    }

    await linkImages();
  } catch (err) {
    console.error("Error in main process:", err);
  }
}

main().catch(console.error);
