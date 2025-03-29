require("dotenv").config({ path: ".env.local" });
const axios = require("axios");

// Debug environment variables
console.log("Environment variables:");
console.log("NEXT_PUBLIC_COSMIC_BUCKET_SLUG:", process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
console.log("COSMIC_WRITE_KEY:", process.env.COSMIC_WRITE_KEY ? "Present" : "Missing");
console.log("NEXT_PUBLIC_COSMIC_READ_KEY:", process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? "Present" : "Missing");

async function testImageMatching(testFilenames) {
  console.log(`Testing image matching for ${testFilenames.length} sample filenames`);

  try {
    // Get all media from Cosmic
    const mediaResponse = await axios.get(`https://api.cosmicjs.com/v3/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/media`, {
      params: {
        read_key: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
        limit: 1000, // Increase limit to check more media
        props: "id,name,original_name,imgix_url",
      },
    });

    const allMedia = mediaResponse.data?.media || [];
    console.log(`Found ${allMedia.length} total media items in Cosmic`);

    // Print a few samples of what's in Cosmic
    console.log("\nSample of media in Cosmic:");
    allMedia.slice(0, 10).forEach((m, i) => {
      console.log(`[${i + 1}] Name: ${m.name}, Original: ${m.original_name}`);
    });

    // Test each filename
    console.log("\nTesting filename matching...");
    for (const filename of testFilenames) {
      console.log(`\nLooking for match for: ${filename}`);

      // Parse the filename to get parts we can use for fuzzy matching
      const filenameParts = filename.split(".");
      const filenameWithoutExt = filenameParts[0];
      const fileExt = filenameParts.length > 1 ? filenameParts[filenameParts.length - 1] : "";

      // Try different matching strategies

      // 1. Exact match
      let matchingMedia = allMedia.find((m) => m.original_name === filename || m.original_name.endsWith(`/${filename}`) || m.name === filename);

      if (matchingMedia) {
        console.log(`✓ Found exact match:`);
        console.log(`  Name: ${matchingMedia.name}`);
        console.log(`  Original name: ${matchingMedia.original_name}`);
        continue;
      }

      // 2. Filename without extension
      matchingMedia = allMedia.find((m) => {
        const mOriginal = m.original_name || "";
        const mName = m.name || "";

        return mOriginal.includes(filenameWithoutExt) || mName.includes(filenameWithoutExt);
      });

      if (matchingMedia) {
        console.log(`✓ Found match by filename without extension:`);
        console.log(`  Name: ${matchingMedia.name}`);
        console.log(`  Original name: ${matchingMedia.original_name}`);
        continue;
      }

      // 3. Partial match for long filenames
      if (filenameWithoutExt.length > 8) {
        // Get first 8 chars
        const filenameStart = filenameWithoutExt.substring(0, 8);
        console.log(`Trying partial match with: ${filenameStart}`);

        const partialMatches = allMedia.filter((m) => {
          const mOriginal = m.original_name || "";
          const mName = m.name || "";

          return mOriginal.includes(filenameStart) || mName.includes(filenameStart);
        });

        if (partialMatches.length > 0) {
          console.log(`✓ Found ${partialMatches.length} partial matches:`);
          partialMatches.slice(0, 3).forEach((m, i) => {
            console.log(`  [${i + 1}] Name: ${m.name}, Original: ${m.original_name}`);
          });
          continue;
        }
      }

      console.log(`✗ No match found for: ${filename}`);
    }
  } catch (error) {
    console.error(`Error in image matching test: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Sample filenames to test
const testFilenames = ["a0914025926_16.jpeg", "a1251842747_10.jpeg", "Ano-Nobo-Hi-Res-1000-x-1000-300-DPI-Front-Cover.jpg", "image.png"];

// Run the test
testImageMatching(testFilenames);
