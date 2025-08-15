const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");
const axios = require("axios");

// Configuration
const config = {
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
};

// Validate configuration
if (!config.cosmic.bucketSlug || !config.cosmic.readKey || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration. Please check your .env file.");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

// Get all takeovers from Craft CMS using GraphQL API
async function fetchTakeoversFromCraft() {
  try {
    console.log("🔍 Fetching takeovers from Craft CMS via GraphQL...");

    // First, let's check what sections are available
    const sectionsQuery = `
      query {
        sections {
          id
          name
          handle
          entryTypes {
            id
            name
            handle
          }
        }
      }
    `;

    console.log("📋 Checking available sections...");
    const sectionsResponse = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: sectionsQuery },
      timeout: 30000,
    });

    if (sectionsResponse.data.errors) {
      console.error("GraphQL Errors (sections):", JSON.stringify(sectionsResponse.data.errors, null, 2));
    } else {
      const sections = sectionsResponse.data.data.sections || [];
      console.log("📋 Available sections:");
      sections.forEach((section) => {
        console.log(`   - ${section.name} (${section.handle})`);
        if (section.entryTypes) {
          section.entryTypes.forEach((entryType) => {
            console.log(`     └─ ${entryType.name} (${entryType.handle})`);
          });
        }
      });
    }

    // Try to get categories (takeovers might be stored as categories)
    console.log("🔍 Checking for categories...");

    // Try a very basic query to see what's available
    const basicQuery = `
      query {
        __schema {
          types {
            name
            fields {
              name
              type {
                name
              }
            }
          }
        }
      }
    `;

    try {
      const basicResponse = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: basicQuery },
        timeout: 30000,
      });

      if (!basicResponse.data.errors) {
        console.log("✅ Basic GraphQL schema query successful");

        // Now try a simple categories query
        const simpleCategoriesQuery = `
          query {
            categories(limit: 10) {
              id
              title
              slug
            }
          }
        `;

        const categoriesResponse = await axios({
          url: config.craft.apiUrl,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data: { query: simpleCategoriesQuery },
          timeout: 30000,
        });

        if (!categoriesResponse.data.errors) {
          const categories = categoriesResponse.data.data.categories || [];
          console.log(`📊 Found ${categories.length} categories with simple query`);

          // Show what we got
          categories.forEach((cat) => {
            console.log(`   - ${cat.title} (${cat.slug})`);
          });

          // Now try to get more with image fields
          const fullCategoriesQuery = `
            query {
              categories(limit: 1000) {
                id
                title
                slug
                featuredImage {
                  id
                  url
                  filename
                  title
                }
                image {
                  id
                  url
                  filename
                  title
                }
                thumbnail {
                  id
                  url
                  filename
                  title
                }
                heroImage {
                  id
                  url
                  filename
                  title
                }
                bannerImage {
                  id
                  url
                  filename
                  title
                }
                coverImage {
                  id
                  url
                  filename
                  title
                }
              }
            }
          `;

          const fullResponse = await axios({
            url: config.craft.apiUrl,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            data: { query: fullCategoriesQuery },
            timeout: 30000,
          });

          if (!fullResponse.data.errors) {
            const fullCategories = fullResponse.data.data.categories || [];
            console.log(`📊 Found ${fullCategories.length} categories with full query`);

            // Since we're only getting 100 categories, let's try to find more by querying
            // categories that might be takeovers based on their titles
            console.log("🔍 Trying to find more takeover categories by searching...");

            // Try multiple search terms to catch more takeovers
            const searchTerms = ["takeover", "curates", "curate", "take over", "take-over"];

            let allTakeoverCategories = [];

            for (const searchTerm of searchTerms) {
              console.log(`   🔍 Searching for: "${searchTerm}"`);
              const searchQuery = `
                    query {
                        categories(limit: 1000, search: "${searchTerm}") {
                            id
                            title
                            slug
                            groupHandle
                            featuredImage { id url filename title }
                            image { id url filename title }
                            thumbnail { id url filename title }
                            heroImage { id url filename title }
                            bannerImage { id url filename title }
                            coverImage { id url filename title }
                        }
                    }
                `;

              try {
                const searchResponse = await axios({
                  url: config.craft.apiUrl,
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  data: { query: searchQuery },
                  timeout: 30000,
                });

                if (searchResponse.data.data && searchResponse.data.data.categories) {
                  const foundCategories = searchResponse.data.data.categories;
                  console.log(`   ✅ Found ${foundCategories.length} categories for "${searchTerm}"`);

                  // Add unique categories (avoid duplicates)
                  for (const category of foundCategories) {
                    if (!allTakeoverCategories.find((existing) => existing.id === category.id)) {
                      allTakeoverCategories.push(category);
                    }
                  }
                }
              } catch (error) {
                console.log(`   ❌ Error searching for "${searchTerm}":`, error.message);
                if (error.response && error.response.data) {
                  console.log(`   GraphQL errors:`, JSON.stringify(error.response.data, null, 2));
                }
              }
            }

            console.log(`🔍 Total unique takeover categories found: ${allTakeoverCategories.length}`);

            // Also try to find specific missing takeovers by searching for their names
            console.log("🔍 Searching for specific missing takeovers...");
            const specificSearchTerms = ["My Analogue Journal", "Time Capsule", "Heavenly Sweetness", "Ishmael Ensemble", "Refugee Week", "Sound System Sisters", "Spot Lite Detroit", "Seloki Records", "Lex Records", "Rebecca Vasmant", "Psychic Hotline", "Worldwide Festival Sète", "SHUSH", "LaMunai Records", "Squama Recordings", "Pitanga Discos"];

            for (const searchTerm of specificSearchTerms) {
              console.log(`   🔍 Searching for: "${searchTerm}"`);
              const specificQuery = `
                    query {
                        categories(limit: 100, search: "${searchTerm}") {
                            id
                            title
                            slug
                            groupHandle
                            featuredImage { id url filename title }
                            image { id url filename title }
                            thumbnail { id url filename title }
                            heroImage { id url filename title }
                            bannerImage { id url filename title }
                            coverImage { id url filename title }
                        }
                    }
                `;

              try {
                const specificResponse = await axios({
                  url: config.craft.apiUrl,
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  data: { query: specificQuery },
                  timeout: 30000,
                });

                if (specificResponse.data.data && specificResponse.data.data.categories) {
                  const foundCategories = specificResponse.data.data.categories;
                  console.log(`   ✅ Found ${foundCategories.length} categories for "${searchTerm}"`);

                  // Add unique categories (avoid duplicates)
                  for (const category of foundCategories) {
                    if (!allTakeoverCategories.find((existing) => existing.id === category.id)) {
                      allTakeoverCategories.push(category);
                    }
                  }
                }
              } catch (error) {
                console.log(`   ❌ Error searching for "${searchTerm}":`, error.message);
                if (error.response && error.response.data) {
                  console.log(`   GraphQL errors:`, JSON.stringify(error.response.data, null, 2));
                }
              }
            }

            console.log(`🔍 Final total unique takeover categories found: ${allTakeoverCategories.length}`);

            // Filter to only include categories that look like takeovers
            const takeoverCategories = allTakeoverCategories.filter((category) => {
              const title = category.title.toLowerCase();
              return title.includes("takeover") || title.includes("curates") || title.includes("curate") || title.includes("take over") || title.includes("take-over");
            });

            console.log(`🔍 Filtered to ${takeoverCategories.length} takeover-like categories`);

            // Use the comprehensive search results we already found
            console.log("🔍 Using comprehensive search results for takeover categories");

            console.log(`🎯 Found ${takeoverCategories.length} potential takeover categories:`);
            takeoverCategories.forEach((cat) => {
              console.log(`   - ${cat.title} (${cat.slug})`);

              // Check all possible image fields
              const imageFields = {
                featuredImage: cat.featuredImage,
                image: cat.image,
                thumbnail: cat.thumbnail,
                heroImage: cat.heroImage,
                bannerImage: cat.bannerImage,
                coverImage: cat.coverImage,
              };

              let hasAnyImage = false;
              Object.entries(imageFields).forEach(([fieldName, fieldValue]) => {
                if (fieldValue) {
                  if (Array.isArray(fieldValue) && fieldValue.length > 0) {
                    // Handle array fields like thumbnail
                    const firstImage = fieldValue[0];
                    if (firstImage && firstImage.url) {
                      console.log(`     🖼️  ${fieldName}: ${firstImage.url}`);
                      hasAnyImage = true;
                    }
                  } else if (fieldValue.url) {
                    // Handle single object fields
                    console.log(`     🖼️  ${fieldName}: ${fieldValue.url}`);
                    hasAnyImage = true;
                  }
                }
              });

              if (!hasAnyImage) {
                console.log(`     ❌ No image found in any field`);
              }
            });

            // Also show some categories that might be takeovers but didn't match our filter
            const otherPotentialTakeovers = fullCategories.filter((cat) => !takeoverCategories.includes(cat) && (cat.title.toLowerCase().includes("takeover") || cat.title.toLowerCase().includes("curates")));

            if (otherPotentialTakeovers.length > 0) {
              console.log(`\n🔍 Other potential takeovers found:`);
              otherPotentialTakeovers.forEach((cat) => {
                console.log(`   - ${cat.title} (${cat.slug})`);
              });
            }

            return takeoverCategories;
          } else {
            console.log("   ⚠️  GraphQL errors for full categories:", fullResponse.data.errors[0]?.message);
            return categories; // Return the simple ones
          }
        } else {
          console.log("   ⚠️  GraphQL errors for simple categories:", categoriesResponse.data.errors[0]?.message);
          return [];
        }
      } else {
        console.log("   ⚠️  GraphQL schema query failed:", basicResponse.data.errors[0]?.message);
        return [];
      }
    } catch (error) {
      console.log("   ❌ Error with GraphQL queries:", error.message);
      return [];
    }
  } catch (error) {
    console.error("❌ Failed to fetch takeovers from Craft:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

// Get all takeovers from Cosmic
async function fetchTakeoversFromCosmic() {
  try {
    console.log("🔍 Fetching takeovers from Cosmic...");

    const response = await cosmic.objects.find({
      type: "takeovers",
      props: "id,slug,title,metadata",
      limit: 1000,
    });

    const takeovers = response.objects || [];
    console.log(`✅ Found ${takeovers.length} takeovers from Cosmic`);
    return takeovers;
  } catch (error) {
    console.error("❌ Failed to fetch takeovers from Cosmic:", error.message);
    return [];
  }
}

// Find exact title matches between Craft and Cosmic
function findExactMatches(craftTakeovers, cosmicTakeovers) {
  const matches = [];
  const unmatched = [];

  console.log("\n🔍 DEBUGGING: First few Cosmic titles:");
  cosmicTakeovers.slice(0, 5).forEach((t) => console.log(`   "${t.title}"`));

  console.log("\n🔍 DEBUGGING: First few Craft titles:");
  craftTakeovers.slice(0, 5).forEach((t) => console.log(`   "${t.title}"`));

  for (const cosmicTakeover of cosmicTakeovers) {
    // Try to find exact match first
    let craftMatch = craftTakeovers.find((craft) => craft.title === cosmicTakeover.title);

    // If no exact match, try to match by removing "Takeover" or "curates" suffix
    if (!craftMatch) {
      const cleanTitle = cosmicTakeover.title
        .replace(/\s+Takeover$/i, "")
        .replace(/\s+curates$/i, "")
        .trim();

      craftMatch = craftTakeovers.find((craft) => craft.title === cleanTitle);
    }

    if (craftMatch) {
      matches.push({
        cosmic: cosmicTakeover,
        craft: craftMatch,
        matchType: craftMatch.title === cosmicTakeover.title ? "exact" : "cleaned",
        originalTitle: cosmicTakeover.title,
        cleanedTitle: craftMatch.title,
      });
    } else {
      unmatched.push({
        cosmic: cosmicTakeover,
        reason: "No title match found in Craft CMS (even after cleaning)",
        attemptedMatches: [
          cosmicTakeover.title,
          cosmicTakeover.title
            .replace(/\s+Takeover$/i, "")
            .replace(/\s+curates$/i, "")
            .trim(),
        ],
      });
    }
  }

  return { matches, unmatched };
}

// Update Cosmic takeover with image from Craft
async function updateTakeoverImage(cosmicTakeover, craftTakeover) {
  try {
    // Check for image in thumbnail field first (array structure)
    let imageUrl = null;

    if (craftTakeover.thumbnail && Array.isArray(craftTakeover.thumbnail) && craftTakeover.thumbnail.length > 0) {
      imageUrl = craftTakeover.thumbnail[0].url;
    } else if (craftTakeover.featuredImage && craftTakeover.featuredImage.url) {
      imageUrl = craftTakeover.featuredImage.url;
    } else if (craftTakeover.image && craftTakeover.image.url) {
      imageUrl = craftTakeover.image.url;
    } else if (craftTakeover.heroImage && craftTakeover.heroImage.url) {
      imageUrl = craftTakeover.heroImage.url;
    } else if (craftTakeover.bannerImage && craftTakeover.bannerImage.url) {
      imageUrl = craftTakeover.bannerImage.url;
    } else if (craftTakeover.coverImage && craftTakeover.coverImage.url) {
      imageUrl = craftTakeover.coverImage.url;
    }

    if (!imageUrl) {
      console.log(`⚠️  No image found for "${cosmicTakeover.title}"`);
      return false;
    }

    console.log(`🖼️  Processing "${cosmicTakeover.title}" with image: ${imageUrl}`);

    // Download the image from Craft CMS
    console.log(`   📥 Downloading image from Craft CMS...`);
    const imageResponse = await axios({
      url: imageUrl,
      method: "GET",
      responseType: "arraybuffer",
      timeout: 30000,
    });

    if (!imageResponse.data) {
      console.log(`   ❌ Failed to download image from ${imageUrl}`);
      return false;
    }

    // Convert to Buffer for Cosmic
    const imageBuffer = Buffer.from(imageResponse.data);

    // Extract filename from URL
    const urlParts = imageUrl.split("/");
    const filename = urlParts[urlParts.length - 1].split("?")[0]; // Remove query params

    // Upload to Cosmic Media
    console.log(`   📤 Uploading image to Cosmic Media: ${filename}`);
    
    let mediaResponse;
    try {
      // Create file object like the working script
      const file = {
        originalname: filename,
        buffer: imageBuffer,
      };

      mediaResponse = await cosmic.media.insertOne({
        media: file,
      });
      
      console.log(`   📤 Media upload response:`, JSON.stringify(mediaResponse, null, 2));
    } catch (uploadError) {
      console.log(`   ❌ Media upload failed:`, uploadError.message);
      if (uploadError.response) {
        console.log(`   Response status:`, uploadError.response.status);
        console.log(`   Response data:`, JSON.stringify(uploadError.response.data, null, 2));
      }
      return false;
    }

    if (!mediaResponse || !mediaResponse.media) {
      console.log(`   ❌ Failed to upload image to Cosmic Media - invalid response structure`);
      return false;
    }

    console.log(`   ✅ Image uploaded to Cosmic Media: ${mediaResponse.media.name}`);

    // Verify the media was actually created by checking if it exists in Cosmic
    console.log(`   🔍 Verifying media exists in Cosmic...`);
    try {
      const mediaCheck = await cosmic.media.findOne({ id: mediaResponse.media.id });
      if (!mediaCheck) {
        console.log(`   ❌ Media not found in Cosmic after upload - upload may have failed`);
        return false;
      }
      console.log(`   ✅ Media verified as existing in Cosmic: ${mediaCheck.media.name}`);
    } catch (error) {
      console.log(`   ❌ Error verifying media: ${error.message}`);
      return false;
    }

    // Update with the image URL directly (we can handle media upload separately later)
    const updateData = {
      metadata: {
        image: mediaResponse.media.name, // Use the media name as specified in Cosmic docs
      },
      thumbnail: mediaResponse.media.name, // thumbnail also uses the media name
    };

    console.log(`   📤 Sending update data:`, JSON.stringify(updateData, null, 2));

    await cosmic.objects.updateOne(cosmicTakeover.id, updateData);

    console.log(`✅ Successfully updated "${cosmicTakeover.title}"`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update "${cosmicTakeover.title}":`, error.message || error);
    if (error.response) {
      console.error(`   Response status: ${error.response.status}`);
      console.error(`   Response data:`, error.response.data);
    }
    if (error.request) {
      console.error(`   Request error:`, error.request);
    }
    console.error(`   Full error:`, error);
    return false;
  }
}

// Main execution function
async function main() {
  try {
    console.log("🚀 Starting takeover image matching process...\n");

    // Fetch data from both sources
    const [craftTakeovers, cosmicTakeovers] = await Promise.all([fetchTakeoversFromCraft(), fetchTakeoversFromCosmic()]);

    if (craftTakeovers.length === 0 || cosmicTakeovers.length === 0) {
      console.error("❌ No data found from one or both sources");
      return;
    }

    // Find matches
    const { matches, unmatched } = findExactMatches(craftTakeovers, cosmicTakeovers);

    console.log("\n📊 MATCHING RESULTS:");
    console.log(`✅ Exact matches: ${matches.length}`);
    console.log(`❌ Unmatched: ${unmatched.length}`);
    console.log(`📈 Match rate: ${((matches.length / cosmicTakeovers.length) * 100).toFixed(1)}%`);

    // Display matches
    if (matches.length > 0) {
      console.log("\n🎯 MATCHES FOUND:");
      matches.forEach((match, index) => {
        console.log(`${index + 1}. "${match.cosmic.title}"`);
        console.log(`   Cosmic ID: ${match.cosmic.id}`);
        console.log(`   Craft ID: ${match.craft.id}`);
        console.log(`   Match Type: ${match.matchType === "exact" ? "✅ Exact" : "🔧 Cleaned"}`);
        if (match.matchType === "cleaned") {
          console.log(`   Original: "${match.originalTitle}"`);
          console.log(`   Cleaned: "${match.cleanedTitle}"`);
        }

        // Check if the takeover has any image
        const hasImage = (match.craft.thumbnail && Array.isArray(match.craft.thumbnail) && match.craft.thumbnail.length > 0) || (match.craft.featuredImage && match.craft.featuredImage.url) || (match.craft.image && match.craft.image.url) || (match.craft.heroImage && match.craft.heroImage.url) || (match.craft.bannerImage && match.craft.bannerImage.url) || (match.craft.coverImage && match.craft.coverImage.url);

        console.log(`   Has Image: ${hasImage ? "✅" : "❌"}`);
        if (hasImage) {
          // Find the actual image URL
          let imageUrl = null;
          if (match.craft.thumbnail && Array.isArray(match.craft.thumbnail) && match.craft.thumbnail.length > 0) {
            imageUrl = match.craft.thumbnail[0].url;
          } else if (match.craft.featuredImage && match.craft.featuredImage.url) {
            imageUrl = match.craft.featuredImage.url;
          } else if (match.craft.image && match.craft.image.url) {
            imageUrl = match.craft.image.url;
          } else if (match.craft.heroImage && match.craft.heroImage.url) {
            imageUrl = match.craft.heroImage.url;
          } else if (match.craft.bannerImage && match.craft.bannerImage.url) {
            imageUrl = match.craft.bannerImage.url;
          } else if (match.craft.coverImage && match.craft.coverImage.url) {
            imageUrl = match.craft.coverImage.url;
          }
          if (imageUrl) {
            console.log(`   Image URL: ${imageUrl}`);
          }
        }
        console.log("");
      });
    }

    // Display unmatched
    if (unmatched.length > 0) {
      console.log("\n❌ UNMATCHED TAKEOVERS:");
      unmatched.forEach((item, index) => {
        console.log(`${index + 1}. "${item.cosmic.title}" - ${item.reason}`);
      });
    }

    // Ask user if they want to proceed with updates
    if (matches.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("VERIFICATION COMPLETE");
      console.log("=".repeat(60));
      console.log(`Found ${matches.length} exact matches between Craft CMS and Cosmic.`);
      console.log("The script is ready to update images for these takeovers.");
      console.log("\nTo proceed with image updates, run this script with the --update flag:");
      console.log("node scripts/match-takeover-images.js --update");
    }
  } catch (error) {
    console.error("❌ Script execution failed:", error.message);
    process.exit(1);
  }
}

// Check if user wants to update images
async function updateImages() {
  try {
    console.log("🚀 Starting image update process...\n");

    const [craftTakeovers, cosmicTakeovers] = await Promise.all([fetchTakeoversFromCraft(), fetchTakeoversFromCosmic()]);

    const { matches } = findExactMatches(craftTakeovers, cosmicTakeovers);

    if (matches.length === 0) {
      console.log("❌ No matches found to update");
      return;
    }

    console.log(`🔄 Updating ${matches.length} takeovers with images...\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const match of matches) {
      const success = await updateTakeoverImage(match.cosmic, match.craft);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("\n" + "=".repeat(60));
    console.log("UPDATE COMPLETE");
    console.log("=".repeat(60));
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed to update: ${failureCount}`);
    console.log(`📊 Total processed: ${matches.length}`);
  } catch (error) {
    console.error("❌ Image update failed:", error.message);
    process.exit(1);
  }
}

// Check command line arguments
const shouldUpdate = process.argv.includes("--update");

if (shouldUpdate) {
  updateImages();
} else {
  main();
}
