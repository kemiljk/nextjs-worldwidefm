require("dotenv").config();
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");
const { parseISO, format, isValid } = require("date-fns");

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

// Helper function to extract date from title
function extractDateFromTitle(title) {
  // Common date formats in titles
  const datePatterns = [
    // DD.MM.YY or DD.MM.YYYY
    /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/,
    // DD/MM/YY or DD/MM/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
    // DD-MM-YY or DD-MM-YYYY
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
    // YYYY-MM-DD
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    // Month DD, YYYY
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = title.match(pattern);
    if (match) {
      try {
        let year, month, day;

        if (pattern.toString().includes("[A-Za-z]+")) {
          // Handle "Month DD, YYYY" format
          const monthName = match[1];
          day = parseInt(match[2], 10);
          year = parseInt(match[3], 10);

          // Convert month name to number (1-12)
          const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          month = monthNames.findIndex((m) => monthName.toLowerCase().startsWith(m)) + 1;
        } else if (pattern.toString().includes("\\d{4}-")) {
          // Handle YYYY-MM-DD format
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          day = parseInt(match[3], 10);
        } else {
          // Handle DD.MM.YY, DD/MM/YY, DD-MM-YY formats
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          year = parseInt(match[3], 10);

          // Convert 2-digit years to 4-digit
          if (year < 100) {
            year += year < 50 ? 2000 : 1900;
          }
        }

        // Validate date components
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
          continue;
        }

        // Format date as YYYY-MM-DD
        return format(new Date(year, month - 1, day), "yyyy-MM-dd");
      } catch (error) {
        console.error(`Error parsing date from title "${title}":`, error);
      }
    }
  }

  return null;
}

async function getShowsFromMySQL() {
  try {
    console.log("Connecting to MySQL database...");
    const connection = await mysql.createConnection(dbConfig);

    // Get episodes with their broadcast dates
    const [episodes] = await connection.execute(`
      SELECT 
        e.id,
        c.title,
        s.slug,
        c.field_broadcastDate as broadcast_date,
        e.dateCreated
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      WHERE e.sectionId = (SELECT id FROM craft_sections WHERE handle = 'episode')
      AND e.deletedWithEntryType IS NULL
      AND s.enabled = 1
      ORDER BY e.dateCreated DESC
    `);

    await connection.end();

    console.log(`\nFound ${episodes.length} episodes`);
    return episodes;
  } catch (error) {
    console.error("Error getting episodes from MySQL:", error);
    return [];
  }
}

async function updateShowBroadcastDate(showId, broadcastDate) {
  try {
    // Parse the date and ensure it's in YYYY-MM-DD format
    let formattedDate;

    try {
      // Try to parse the date
      const parsedDate = new Date(broadcastDate);
      if (isValid(parsedDate)) {
        formattedDate = format(parsedDate, "yyyy-MM-dd");
      } else {
        console.log(`Invalid date format for show ${showId}: ${broadcastDate}`);
        return null;
      }
    } catch (error) {
      console.log(`Error parsing date for show ${showId}: ${broadcastDate}`);
      return null;
    }

    const response = await cosmic.objects.updateOne(showId, {
      metadata: {
        broadcast_date: formattedDate,
      },
    });

    if (!response || !response.object) {
      throw new Error("No object returned from updateOne");
    }

    return response.object;
  } catch (error) {
    console.error(`Error updating broadcast date for show ${showId}:`, error);
    return null;
  }
}

async function updateBroadcastDates() {
  try {
    // Get all shows from MySQL
    const episodes = await getShowsFromMySQL();
    console.log(`Processing ${episodes.length} episodes...`);

    // Get all shows from Cosmic
    const cosmicShows = await cosmic.objects.find({
      type: "radio-shows",
      limit: 1000,
    });

    // Create a map of slugs to Cosmic show IDs
    const cosmicShowMap = new Map(cosmicShows.objects.map((show) => [show.slug, show.id]));

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const episode of episodes) {
      try {
        // Find matching show in Cosmic
        const cosmicShowId = cosmicShowMap.get(episode.slug);
        if (!cosmicShowId) {
          console.log(`No matching show found in Cosmic for "${episode.title}"`);
          skippedCount++;
          continue;
        }

        // Try to get broadcast date from MySQL first
        let broadcastDate = episode.broadcast_date;

        // If no broadcast date in MySQL, try to extract from title
        if (!broadcastDate) {
          broadcastDate = extractDateFromTitle(episode.title);
        }

        // If we have a broadcast date, update the show
        if (broadcastDate) {
          const updatedShow = await updateShowBroadcastDate(cosmicShowId, broadcastDate);
          if (updatedShow) {
            console.log(`Updated broadcast date for "${episode.title}" to ${broadcastDate}`);
            updatedCount++;
          } else {
            errorCount++;
          }
        } else {
          console.log(`No broadcast date found for "${episode.title}"`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing episode "${episode.title}":`, error);
        errorCount++;
      }
    }

    console.log("\nUpdate Summary:");
    console.log(`Total episodes processed: ${episodes.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Skipped (no date found): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
  } catch (error) {
    console.error("Error during update:", error);
  }
}

// Run the update
updateBroadcastDates().catch(console.error);
