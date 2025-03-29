require("dotenv").config({ path: ".env.local" });
const { createBucketClient } = require("@cosmicjs/sdk");
const mysql = require("mysql2/promise");
const fetch = require("node-fetch");
const axios = require("axios");

// Debug environment variables
console.log("Environment variables:");
console.log("NEXT_PUBLIC_COSMIC_BUCKET_SLUG:", process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
console.log("COSMIC_WRITE_KEY:", process.env.COSMIC_WRITE_KEY ? "Present" : "Missing");
console.log("NEXT_PUBLIC_COSMIC_READ_KEY:", process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? "Present" : "Missing");

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

// MySQL configuration (for checking original data)
const mysqlConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  database: process.env.DB_NAME || "worldwidefm",
};

async function getConnection() {
  try {
    return await mysql.createConnection(mysqlConfig);
  } catch (error) {
    console.error("Failed to connect to MySQL:", error);
    console.log("Continuing without MySQL connection...");
    return null;
  }
}

async function findEditorialAlbumEntriesFromMySQL() {
  console.log("Checking MySQL for Album of the Week entries...");

  const connection = await getConnection();
  if (!connection) {
    console.log("No MySQL connection - skipping database check");
    return [];
  }

  try {
    // First, check table structure
    console.log("Checking table structure in MySQL...");

    // Get editorial section ID
    const [sections] = await connection.execute("SELECT id FROM craft_sections WHERE handle = ?", ["editorial"]);

    if (!sections || sections.length === 0) {
      console.log("No editorial section found in MySQL");
      return [];
    }

    const sectionId = sections[0].id;

    // Simplified approach to find album-related entries
    // First get IDs only to prevent GROUP BY issues
    // Only include published entries by joining with elements table
    const [entryIds] = await connection.execute(
      `
      SELECT DISTINCT e.id, e.postDate
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements el ON e.id = el.id
      WHERE e.sectionId = ? 
      AND el.enabled = 1
      AND (
        LOWER(c.title) LIKE '%album of the week%' 
        OR LOWER(c.title) LIKE '%album%week%'
        OR LOWER(c.title) LIKE '%album rundown%'
      )
      ORDER BY e.postDate DESC
    `,
      [sectionId]
    );

    console.log(`Found ${entryIds?.length || 0} potential Album of the Week entry IDs`);

    if (!entryIds || entryIds.length === 0) {
      console.log("No Album of the Week entries found in MySQL - trying broader search");

      // Try a broader search
      const [broadIds] = await connection.execute(
        `
        SELECT DISTINCT e.id, e.postDate
        FROM craft_entries e
        JOIN craft_content c ON e.id = c.elementId
        JOIN craft_elements el ON e.id = el.id
        WHERE e.sectionId = ? 
        AND el.enabled = 1
        AND LOWER(c.title) LIKE '%album%'
        ORDER BY e.postDate DESC
        LIMIT 20
      `,
        [sectionId]
      );

      if (!broadIds || broadIds.length === 0) {
        console.log("No album-related entries found with broader search");
        return [];
      }

      console.log(`Found ${broadIds.length} potential album-related entries with broader search`);
      entryIds.push(...broadIds);
    }

    // Now fetch full details for each ID individually
    const entries = [];
    const processedSlugs = new Set(); // Track processed slugs to avoid duplicates

    for (const row of entryIds) {
      const entryId = row.id;

      // Get entry details
      const [entryDetails] = await connection.execute(
        `
        SELECT 
          e.*,
          c.*,
          s.slug as entry_slug,
          el.enabled
        FROM craft_entries e
        JOIN craft_content c ON e.id = c.elementId
        JOIN craft_elements_sites s ON e.id = s.elementId
        JOIN craft_elements el ON e.id = el.id
        WHERE e.id = ?
      `,
        [entryId]
      );

      if (entryDetails && entryDetails.length > 0) {
        const entry = entryDetails[0];

        // Skip if not enabled/published or if we've already processed this slug
        if (entry.enabled !== 1 || processedSlugs.has(entry.entry_slug)) {
          console.log(`Skipping ${entry.enabled !== 1 ? "unpublished" : "duplicate"} entry: ${entry.title}`);
          continue;
        }

        processedSlugs.add(entry.entry_slug);

        // Get related assets (images)
        const [assetRelations] = await connection.execute(
          `
          SELECT r.fieldId, r.targetId
          FROM craft_relations r
          WHERE r.sourceId = ?
        `,
          [entryId]
        );

        if (assetRelations && assetRelations.length > 0) {
          // Get the first image asset
          const [assets] = await connection.execute(
            `
            SELECT a.*, v.url, v.handle 
            FROM craft_assets a
            JOIN craft_volumes v ON a.volumeId = v.id
            WHERE a.id = ?
          `,
            [assetRelations[0].targetId]
          );

          if (assets && assets.length > 0) {
            const asset = assets[0];
            console.log(`Found image asset: ${asset.filename} for entry "${entry.title}"`);

            // We'll need the full path, volume handle, and filename to properly map to Cosmic
            entry.assetData = {
              filename: asset.filename,
              url: asset.url,
              handle: asset.handle,
              volumePath: asset.url.replace(asset.filename, ""),
            };

            // Try to also get the image transform for better mapping
            const [transforms] = await connection.execute(
              `
              SELECT * FROM craft_assettransforms
              WHERE handle = 'thumb' OR handle = 'thumbnail' OR handle = 'small'
              LIMIT 1
            `
            );

            if (transforms && transforms.length > 0) {
              entry.assetData.transform = transforms[0];
            }
          }
        }

        entries.push(entry);
      }
    }

    console.log(`Successfully retrieved ${entries.length} unique published Album of the Week entries from MySQL`);

    // Print the first few entries for debugging
    if (entries.length > 0) {
      console.log("\nSample of found Album of the Week entries from MySQL:");
      entries.slice(0, 3).forEach((entry, i) => {
        console.log(`[${i + 1}] ${entry.title} (${entry.entry_slug})`);
        console.log(`  Date: ${entry.postDate}`);
        console.log(`  Image: ${entry.assetData ? entry.assetData.filename : "None"}`);

        // Check if excerpt exists in different field names
        const excerpt = entry.excerpt || entry.field_description || entry.field_description_old || entry.field_bodyText || "";

        console.log(`  Excerpt: ${excerpt ? excerpt.substring(0, 100) + "..." : "None"}`);
      });
    }

    return entries;
  } catch (error) {
    console.error("Error querying MySQL:", error);
    return [];
  } finally {
    if (connection) await connection.end();
  }
}

async function findOrCreateSection() {
  console.log('Checking for "Album of the Week" section...');

  try {
    // Check if the section already exists using the correct type
    console.log("Looking for existing section in Cosmic...");
    const existingSection = await cosmic.objects.find({
      type: "sections",
      slug: "album-of-the-week",
    });

    if (existingSection.objects && existingSection.objects.length > 0) {
      console.log('Found existing "Album of the Week" section');
      return existingSection.objects[0];
    }

    // Create a new section if it doesn't exist
    console.log('Creating new "Album of the Week" section');
    const newSection = await cosmic.objects.insertOne({
      title: "Album Of The Week",
      type: "sections",
      slug: "album-of-the-week",
      status: "published",
    });

    console.log("Section created successfully");
    return newSection.object;
  } catch (error) {
    console.error("Error finding or creating section:", error);

    // Return a simple section object as fallback
    console.log("Using fallback section reference");
    return {
      id: "album-of-the-week",
      slug: "album-of-the-week",
      title: "Album Of The Week",
      type: "sections",
    };
  }
}

async function findAlbumOfTheWeekPosts(includeAllStatuses = false) {
  console.log("Finding album-related posts in Cosmic...");

  try {
    // Expanded search to find more potential album-related posts
    const query = {
      type: "posts",
      props: "id,title,slug,metadata,status",
      limit: 100,
    };

    // Only include published status by default
    if (!includeAllStatuses) {
      query.status = "published";
    }

    const posts = await cosmic.objects.find(query);

    if (!posts.objects || posts.objects.length === 0) {
      console.log("No posts found in Cosmic");
      return [];
    }

    // Print detailed info about the first post to understand field structure
    if (posts.objects.length > 0) {
      const firstPost = posts.objects[0];
      console.log("\nExample post structure:");
      console.log(`Title: ${firstPost.title}`);
      console.log(`Type: ${firstPost.type}`);
      console.log(`Status: ${firstPost.status}`);
      console.log("Metadata fields:");
      Object.keys(firstPost.metadata).forEach((key) => {
        console.log(`  ${key}: ${JSON.stringify(firstPost.metadata[key])}`);
      });
    }

    // Filter posts that are specifically related to album reviews
    // but are NOT already in the Album of the Week section
    const albumPosts = posts.objects.filter((post) => {
      const title = post.title.toLowerCase();
      const hasAlbumContent = title.includes("album rundown") || title.includes("album review") || (title.includes("album") && title.includes("feature")) || title.match(/^album:\s.+$/i); // Titles that start with "Album: "

      // Skip posts that are already in the Album of the Week section
      const alreadyInSection = post.metadata?.section_name === "67e7d278780d951be77cd53f" || (post.metadata?.section_name && typeof post.metadata.section_name === "string" && post.metadata.section_name.includes("Album of the Week"));

      return hasAlbumContent && !alreadyInSection;
    });

    console.log(`Found ${albumPosts.length} album-related posts in Cosmic`);

    // Log details of each album post for debugging
    if (albumPosts.length > 0) {
      console.log("\nAlbum posts details:");
      albumPosts.forEach((post, index) => {
        console.log(`\n[${index + 1}] ${post.title} (${post.slug})`);
        console.log(`  section_name: ${JSON.stringify(post.metadata.section_name)}`);
        console.log(`  section_priority: ${post.metadata.section_priority}`);
        console.log(`  type: ${JSON.stringify(post.metadata.type)}`);
      });
    }

    return albumPosts;
  } catch (error) {
    console.error("Error finding album posts:", error);
    throw error;
  }
}

async function findPotentiallyCorruptedPosts() {
  console.log("Looking for potentially corrupted album posts...");

  try {
    // Check for album posts with non-published status
    const nonPublishedQuery = {
      type: "posts",
      status: { $not: "published" },
      props: "id,title,slug,metadata,status",
      limit: 100,
    };

    const nonPublishedResults = await cosmic.objects.find(nonPublishedQuery);

    if (!nonPublishedResults.objects || nonPublishedResults.objects.length === 0) {
      console.log("No non-published posts found");
      return [];
    }

    // Filter for potential album posts
    const potentiallyCorrupted = nonPublishedResults.objects.filter((post) => {
      const title = post.title.toLowerCase();
      const excerpt = post.metadata.excerpt ? post.metadata.excerpt.toLowerCase() : "";
      const content = post.metadata.content ? post.metadata.content.toLowerCase() : "";

      return title.includes("album") || excerpt.includes("album") || content.includes("album of the week") || title.includes("review");
    });

    console.log(`Found ${potentiallyCorrupted.length} potentially corrupted album posts`);
    return potentiallyCorrupted;
  } catch (error) {
    console.error("Error finding corrupted posts:", error);
    return [];
  }
}

async function updatePost(cosmicPost, albumOfTheWeekMetafield) {
  console.log("Updating post: ", cosmicPost.title);
  console.log("Current metadata: ", JSON.stringify(cosmicPost.metadata, null, 2));
  console.log("Updated metadata will have Album of the Week section: ", albumOfTheWeekMetafield);

  try {
    // Directly create the full update request with all required fields
    const updateRequest = {
      id: cosmicPost.id,
      type: cosmicPost.type_slug || cosmicPost.type,
      slug: cosmicPost.slug,
      title: cosmicPost.title,
      status: cosmicPost.status,
      metadata: {
        ...cosmicPost.metadata,
        album_of_the_week: albumOfTheWeekMetafield,
      },
    };

    console.log("Sending update request: ", JSON.stringify(updateRequest, null, 2));

    // Try using the SDK first
    try {
      const result = await cosmic.objects.updateOne(updateRequest);
      console.log("Update result: ", JSON.stringify(result, null, 2));
      return true;
    } catch (sdkError) {
      console.error("SDK update failed, trying direct API call:", sdkError.message);

      // Fall back to direct API call with correct endpoint
      // Correct API endpoint format: https://api.cosmicjs.com/v3/buckets/{bucket_slug}/objects/{object_id}
      const apiUrl = `https://api.cosmicjs.com/v3/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/objects/${cosmicPost.id}`;

      console.log(`Making direct API call to: ${apiUrl}`);

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.COSMIC_WRITE_KEY}`,
      };

      const response = await axios.patch(apiUrl, updateRequest, { headers });

      if (response.data && response.status >= 200 && response.status < 300) {
        console.log("Direct API call succeeded:", JSON.stringify(response.data, null, 2));
        return true;
      } else {
        console.error("Direct API call returned unexpected response:", response.status, JSON.stringify(response.data, null, 2));
        return false;
      }
    }
  } catch (error) {
    console.error("Error updating post: ", error.message);

    // Print detailed error information
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("Request failed to get a response");
    }

    return false;
  }
}

async function restoreCorruptedPost(post, section) {
  try {
    console.log(`Attempting to restore corrupted post: "${post.title}" (${post.slug})`);

    // Update status and section name
    await cosmic.objects.updateOne(post.id, {
      status: "published",
      metadata: {
        ...post.metadata,
        section_name: ["Album Of The Week"],
      },
    });

    console.log(`✓ Successfully restored post: ${post.title}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to restore post "${post.title}":`, error);
    return false;
  }
}

async function createPostFromMySQLEntry(entry, section) {
  try {
    console.log(`Creating new Album of the Week post from MySQL: "${entry.title}" (${entry.entry_slug})`);

    // Create a clean slug based on the original entry slug
    const slug = `album-of-the-week-${entry.entry_slug}`;

    // Extract content from the various possible field names in craft
    const content = entry.field_bodyText || entry.field_description || entry.field_description_old || "";

    const excerpt = entry.excerpt || entry.field_description || (content ? content.substring(0, 150) + "..." : "");

    // For image handling, we need to make sure we're getting the correct image reference
    let imageValue = null;

    if (entry.assetData) {
      // We have detailed asset data
      const assetFilename = entry.assetData.filename;
      console.log(`Looking for media with original_name: ${assetFilename}`);

      try {
        // First try to find directly with original_name matching the filename
        let mediaResponse = await cosmic.media.findOne({
          original_name: assetFilename,
        });

        // If not found, try with path elements
        if (!mediaResponse || !mediaResponse.media) {
          console.log(`No exact match found, trying with path-based search`);
          mediaResponse = await cosmic.media.findOne({
            original_name: { $regex: assetFilename + "$" }, // Match at end of string
          });
        }

        // If still not found, try a broader search with the filename without extension
        if (!mediaResponse || !mediaResponse.media) {
          const filenameParts = assetFilename.split(".");
          const filenameWithoutExt = filenameParts[0];

          console.log(`No match with full filename, trying without extension: ${filenameWithoutExt}`);
          mediaResponse = await cosmic.media.findOne({
            original_name: { $regex: filenameWithoutExt },
          });
        }

        // Check if we found media and extract the name
        if (mediaResponse && mediaResponse.media) {
          const media = mediaResponse.media;
          console.log(`Found matching media in Cosmic:`);
          console.log(`  Name: ${media.name}`);
          console.log(`  Original name: ${media.original_name}`);
          console.log(`  URL: ${media.imgix_url || media.url}`);

          // Important: Use the media NAME (not original_name) for Cosmic
          imageValue = media.name;
        } else {
          console.log(`No matching media found for: ${assetFilename}`);

          // Try a direct API call for more visibility on what's happening
          console.log("Trying direct API call to list some media items for debugging...");
          const directMediaResponse = await axios.get(`https://api.cosmicjs.com/v3/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/media`, {
            params: {
              read_key: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
              limit: 5,
              props: "id,name,original_name,imgix_url",
            },
          });

          if (directMediaResponse.data && directMediaResponse.data.media) {
            console.log(`Found ${directMediaResponse.data.total || 0} total media items in bucket`);
            console.log("Sample media items:");
            directMediaResponse.data.media.forEach((m, i) => {
              console.log(`[${i + 1}] Name: ${m.name}, Original name: ${m.original_name}`);
            });
          } else {
            console.log("Direct API call returned no media items");
          }
        }
      } catch (error) {
        console.error(`Error searching for media: ${error.message}`);
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }

    // Extract useful content from entry
    const postData = {
      title: entry.title,
      type: "posts",
      slug: slug,
      status: "published",
      // Set thumbnail if available
      ...(imageValue ? { thumbnail: imageValue } : {}),
      metadata: {
        // Only include essential fields
        section_name: "67e7d278780d951be77cd53f", // Album of the Week section ID
        section_priority: 20,
        // Include image in metadata if available
        ...(imageValue ? { image: imageValue } : {}),
        // Include other content from MySQL
        date: entry.postDate ? new Date(entry.postDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        excerpt: excerpt || "",
        content: content || "",
      },
    };

    console.log("Creating post with data:", JSON.stringify(postData, null, 2));

    const result = await cosmic.objects.insertOne(postData);

    console.log(`✓ Successfully created new Album of the Week post: ${entry.title}`);
    console.log("New post ID:", result.object.id);
    return true;
  } catch (error) {
    console.error(`✗ Failed to create Album of the Week post from MySQL "${entry.title}":`, error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Create new post with Album of the Week section
async function createAlbumOfTheWeekPost(existingPost, section) {
  try {
    console.log(`Creating new post in Album of the Week section for: "${existingPost.title}"`);

    // Keep the original title without renaming
    const newTitle = existingPost.title;

    // Extract image filename if it exists
    let imageValue = null;
    if (existingPost.metadata.image) {
      console.log("Original image metadata:", JSON.stringify(existingPost.metadata.image, null, 2));

      // Check if we have a URL that contains a media filename
      const urlParts = existingPost.metadata.image.url?.split("/") || [];
      const imgixUrlParts = existingPost.metadata.image.imgix_url?.split("/") || [];

      // Get the last part which should be the filename
      const mediaFilename = urlParts[urlParts.length - 1] || imgixUrlParts[imgixUrlParts.length - 1];

      if (mediaFilename) {
        // Use the entire filename as the image value
        imageValue = mediaFilename;
        console.log(`Using filename as image value: ${imageValue}`);
      }
    }

    // Create a post data object with both metadata and thumbnail
    const postData = {
      title: newTitle,
      type: "posts",
      slug: `${existingPost.slug}-in-album-section`,
      status: "published",
      // Set the top-level thumbnail field if we have an image
      ...(imageValue ? { thumbnail: imageValue } : {}),
      metadata: {
        // Only include essential fields
        section_name: "67e7d278780d951be77cd53f",
        section_priority: 20,
        // Include the image in metadata if available
        ...(imageValue ? { image: imageValue } : {}),
      },
    };

    console.log("Creating post with data:", JSON.stringify(postData, null, 2));

    const result = await cosmic.objects.insertOne(postData);

    console.log(`✓ Successfully created new post in Album of the Week section: ${newTitle}`);
    console.log("New post ID:", result.object.id);
    return true;
  } catch (error) {
    console.error(`✗ Failed to create post in Album of the Week section for "${existingPost.title}":`, error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function migrateAlbumOfTheWeek() {
  try {
    console.log("Starting Album of the Week migration...");

    // First step: make sure we have the Album of the Week section
    const section = await findOrCreateSection();

    // Fetch Album of the Week entries from MySQL
    const mysqlEntries = await findEditorialAlbumEntriesFromMySQL();

    if (mysqlEntries.length === 0) {
      console.log("No Album of the Week entries found in MySQL database");
      console.log("You may need to check your MySQL connection settings or the query");
      return;
    }

    // Print some debug information
    console.log(`Found ${mysqlEntries.length} Album of the Week entries in MySQL database to migrate`);
    mysqlEntries.forEach((entry, i) => {
      if (i < 10) {
        // Only show the first 10 to avoid too much output
        console.log(`[${i + 1}] ${entry.title} (${entry.entry_slug})`);
      }
    });

    // Migration statistics
    let createdCount = 0;
    let failedCount = 0;

    // Create new Album of the Week posts for each MySQL entry
    console.log("\nCreating new Album of the Week posts...");
    for (const entry of mysqlEntries) {
      const success = await createPostFromMySQLEntry(entry, section);
      if (success) {
        createdCount++;
      } else {
        failedCount++;
      }
    }

    // Print summary
    console.log("\n=== Album of the Week Migration Summary ===");
    console.log(`Total MySQL entries found: ${mysqlEntries.length}`);
    console.log(`New Album of the Week posts created: ${createdCount}`);
    console.log(`Failed operations: ${failedCount}`);
    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateAlbumOfTheWeek();
}

module.exports = {
  migrateAlbumOfTheWeek,
};
