const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");

// Validate environment variables
const requiredEnvVars = ["NEXT_PUBLIC_COSMIC_BUCKET_SLUG", "NEXT_PUBLIC_COSMIC_READ_KEY", "COSMIC_WRITE_KEY"];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}

const nlp = require("compromise");

// Now use the validated environment variables
const COSMIC_CONFIG = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

// Debug logging
console.log("Using Cosmic bucket:", COSMIC_CONFIG.bucketSlug);

// Add Claude API integration for better category prediction
const axios = require("axios");

// Claude API configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY; // Add this to your .env.local
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Add a special case mapping for ambiguous or known items
const MANUAL_CATEGORY_MAPPING = {
  dj: "types", // DJ is a role, not a genre
  producer: "types", // Producer is a role
  ty: "regular-hosts", // Likely a person's name
  "boiler room": "takeovers", // This is a music platform/show
  bashment: "genres", // This is a genre of music
  boogaloo: "genres", // This is a genre of music
  "post bop": "genres", // This is a jazz genre
  nutropic: "genres", // This is a genre
  tropicalia: "genres", // This is a genre
  maastricht: "locations", // This is a Dutch city
  jungle: "genres", // Music genre, not a physical jungle
  detroit: "genres", // When in music context, refers to Detroit techno
  chicago: "genres", // When in music context, refers to Chicago house
  uk: "genres", // When in music context, refers to UK garage/etc.
  bass: "genres", // Music genre element, not a fish
  deep: "genres", // Music descriptor/genre prefix
  future: "genres", // Music genre prefix
  acid: "genres", // Music genre prefix
  hard: "genres", // Music genre prefix
  tribal: "genres", // Music genre descriptor
  cosmic: "genres", // Music genre descriptor
  global: "genres", // Music genre descriptor
  "album launch": "takeovers", // Event type, not a person
  launch: "takeovers", // Event type
  premiere: "takeovers", // Event type
  showcase: "takeovers", // Event type
  special: "takeovers", // Event descriptor
  exclusive: "takeovers", // Event descriptor
  live: "types", // Performance type
};

// Add a mapping for standardizing common music terms
const STANDARDIZED_TERMS = {
  // Genres
  "hip hop": "hip-hop",
  hiphop: "hip-hop",
  "hip-hop": "hip-hop",
  "drum and bass": "drum & bass",
  "drum n bass": "drum & bass",
  "drum n' bass": "drum & bass",
  "drum & bass": "drum & bass",
  dnb: "drum & bass",
  "d&b": "drum & bass",
  "r&b": "r&b",
  rnb: "r&b",
  "rhythm and blues": "r&b",
  "rhythm & blues": "r&b",
  "house music": "house",
  "techno music": "techno",
  "jazz music": "jazz",
  "reggae music": "reggae",
  "rock music": "rock",
  "electronic music": "electronic",
  "afro beat": "afrobeat",
  "afro-beat": "afrobeat",
  "uk garage": "uk garage",
  ukg: "uk garage",
  "deep house": "deep house",
  "tech house": "tech house",
  "acid house": "acid house",
  "detroit techno": "detroit techno",
  "chicago house": "chicago house",
  "progressive house": "progressive house",
  "ambient music": "ambient",
  "ambient techno": "ambient techno",
  "experimental music": "experimental",
};

/**
 * Standardize a term based on known mappings and formatting rules
 * @param {string} term - The term to standardize
 * @returns {string} - The standardized term
 */
function standardizeTerm(term) {
  if (!term) return term;

  const normalizedTerm = term.toLowerCase().trim();

  // Check if we have a direct mapping
  if (STANDARDIZED_TERMS[normalizedTerm]) {
    return STANDARDIZED_TERMS[normalizedTerm];
  }

  // Apply general formatting rules for genres
  return normalizedTerm;
}

/**
 * Check if two terms are likely duplicates
 * @param {string} term1 - First term
 * @param {string} term2 - Second term
 * @returns {boolean} - True if terms are likely duplicates
 */
function areSimilarTerms(term1, term2) {
  if (!term1 || !term2) return false;

  // Normalize both terms
  const norm1 = standardizeTerm(term1);
  const norm2 = standardizeTerm(term2);

  // Direct match after standardization
  if (norm1 === norm2) return true;

  // Skip further checks if length is too different (more than 3 chars difference)
  // This prevents matching short terms with longer unrelated ones
  if (Math.abs(norm1.length - norm2.length) > 3) {
    return false;
  }

  // Check for high similarity but only for terms over 5 chars
  // This helps prevent false positives with short terms
  if (norm1.length > 5 && norm2.length > 5) {
    const stripped1 = norm1.replace(/[\s-_&.,']/g, "").toLowerCase();
    const stripped2 = norm2.replace(/[\s-_&.,']/g, "").toLowerCase();

    // Only consider a match if both stripped terms are substantial (>5 chars)
    // and they're identical after stripping
    if (stripped1.length > 5 && stripped2.length > 5 && stripped1 === stripped2) {
      return true;
    }

    // Check if one is a substring of the other (for compound terms)
    // But only if they share at least 80% of characters
    if (stripped1.includes(stripped2) || stripped2.includes(stripped1)) {
      const longerTerm = stripped1.length >= stripped2.length ? stripped1 : stripped2;
      const shorterTerm = stripped1.length < stripped2.length ? stripped1 : stripped2;

      // Only consider a match if the shorter term is substantial
      if (shorterTerm.length < 5) return false;

      // Calculate similarity percentage
      const similarity = shorterTerm.length / longerTerm.length;

      // Need at least 80% similarity
      return similarity >= 0.8;
    }
  }

  // More sophisticated checks for potential acronyms or abbreviations
  // For example, "Drum & Bass" and "D&B" should match
  if (isAcronymOf(norm1, norm2) || isAcronymOf(norm2, norm1)) {
    return true;
  }

  return false;
}

/**
 * Check if one term is an acronym of another
 * @param {string} possibleAcronym - Potential acronym to check
 * @param {string} fullTerm - Full term to check against
 * @returns {boolean} - True if possibleAcronym is an acronym of fullTerm
 */
function isAcronymOf(possibleAcronym, fullTerm) {
  // Remove common joiners and lowercase for comparison
  const cleanAcronym = possibleAcronym.replace(/[&+]/g, "").toLowerCase();
  const cleanTerm = fullTerm.toLowerCase();

  // Only proceed if acronym is significantly shorter
  if (cleanAcronym.length >= cleanTerm.length || cleanAcronym.length > 5) {
    return false;
  }

  // Get words from the full term
  const words = cleanTerm.split(/\s+/);

  // Simple case: check if the acronym matches first letters
  if (words.length >= cleanAcronym.length) {
    const firstLetters = words.map((word) => word[0]).join("");
    if (firstLetters === cleanAcronym) {
      return true;
    }
  }

  // Check for other common acronym patterns
  // Example: "D&B" for "Drum & Bass"
  if (cleanAcronym.length <= 3) {
    const initials = words
      .filter((word) => word.length > 1) // Skip articles and short words
      .map((word) => word[0])
      .join("");

    if (initials === cleanAcronym) {
      return true;
    }
  }

  return false;
}

/**
 * Use Claude AI to analyze a term, determining its category, standardized form, and checking for duplicates
 * @param {string} title - The title to analyze
 * @param {Object} existingItems - Map of existing items by category for duplicate checking
 * @returns {Promise<{category: string, reason: string, confidence: number, standardizedTitle: string, possibleDuplicates: Array}>}
 */
async function analyzeWithAI(title, existingItems = null) {
  // Skip AI API call if no API key is provided
  if (!CLAUDE_API_KEY) {
    console.log("No Claude API key provided, cannot proceed without AI analysis");
    return null;
  }

  try {
    // Prepare existing items for duplicate checking
    let existingItemsContext = "";
    if (existingItems) {
      const allItemsByCategory = {};
      let totalItems = 0;

      for (const [category, items] of Object.entries(existingItems)) {
        allItemsByCategory[category] = Array.from(items.values()).map((item) => item.title);
        totalItems += allItemsByCategory[category].length;
      }

      // Only include if we have a reasonable number of items to check
      if (totalItems > 0 && totalItems < 500) {
        existingItemsContext = `
Here are existing items by category to check for duplicates:
${Object.entries(allItemsByCategory)
  .map(([category, items]) => `${category}: ${items.join(", ")}`)
  .join("\n")}
`;
      }
    }

    const prompt = `
You are an expert music categorization and data cleaning system for a radio show website.

Given the item title "${title}", perform these tasks:
1. Categorize it into ONE of these categories:
   - genres (music genres like jazz, techno, house)
   - regular-hosts (people's names, DJs, artists)
   - locations (cities, countries, venues)
   - takeovers (record labels, organizations, events)
   - types (content formats like podcast, mix, live)
   - none (if not clearly fitting any category)

2. For genres, provide a standardized form following these conventions:
   - Lowercase unless proper nouns (e.g., "Detroit techno")
   - Standard genre naming (e.g., "hip-hop" not "hip hop"/"hiphop") 
   - Use "&" in compounds (e.g., "drum & bass" not "drum and bass")
   - Remove redundant words (e.g., "jazz" not "jazz music")

3. Check for potential duplicates in the list of existing items, considering:
   - Different spellings of the same term (e.g., "Hip Hop" vs "Hip-Hop")
   - Abbreviations and their full forms (e.g., "D&B" vs "Drum & Bass")
   - Slight variations that represent the same entity

${existingItemsContext}

Context about the radio website:
- Electronic and underground music focus
- Many terms prioritize music context over geographic (e.g., "Jungle" is a genre, not a place)
- "Detroit", "Chicago", "Berlin" often refer to music styles
- Terms with "records", "radio", "presents" typically indicate labels/shows
- Be very careful with duplicate detection - only flag clear duplicates

Respond in this structured format:
category: [category name]
reason: [brief explanation]
confidence: [0-100]
standardized: [standardized form if applicable]
duplicates: [comma-separated list of likely duplicates, or "none" if none found]
`;

    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 250,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      {
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    // Parse the response
    const aiResponse = response.data.content[0].text.trim();
    const categoryMatch = aiResponse.match(/category:\s*(\w+[-\w]*)/i);
    const reasonMatch = aiResponse.match(/reason:\s*([^\n]+)/i);
    const confidenceMatch = aiResponse.match(/confidence:\s*(\d+)/i);
    const standardizedMatch = aiResponse.match(/standardized:\s*([^\n]+)/i);
    const duplicatesMatch = aiResponse.match(/duplicates:\s*([^\n]+)/i);

    if (categoryMatch && reasonMatch) {
      const category = categoryMatch[1].toLowerCase().trim();
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;

      // Extract potential duplicates
      let possibleDuplicates = [];
      if (duplicatesMatch) {
        const duplicatesStr = duplicatesMatch[1].trim();
        if (duplicatesStr !== "none" && duplicatesStr.length > 0) {
          possibleDuplicates = duplicatesStr.split(",").map((d) => d.trim());
        }
      }

      // Handle items with low confidence or explicitly categorized as 'none'
      if (category === "none" || confidence < 70) {
        console.log(`Low confidence (${confidence}) or "none" category for "${title}", suggesting removal`);
        return {
          category: "none",
          reason: `AI: ${reasonMatch[1].trim()}`,
          confidence: confidence,
          standardizedTitle: title,
          possibleDuplicates: possibleDuplicates,
          shouldRemove: true,
        };
      }

      // Get standardized title if provided
      let standardizedTitle = title;
      if (standardizedMatch && category === "genres") {
        standardizedTitle = standardizedMatch[1].trim();
      }

      return {
        category: category,
        reason: `AI: ${reasonMatch[1].trim()}`,
        confidence: confidence,
        standardizedTitle: standardizedTitle,
        possibleDuplicates: possibleDuplicates,
      };
    }

    console.log(`AI response didn't match expected format: ${aiResponse}`);
    return null;
  } catch (error) {
    console.error(`Error calling Claude API: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
    return null;
  }
}

// Update migrateCategories to rely heavily on AI analysis
async function migrateCategories(dryRun = true) {
  try {
    console.log(`Starting category reorganization... ${dryRun ? "(DRY RUN)" : ""}`);

    // Check if AI API key is available - this is mandatory now
    if (!CLAUDE_API_KEY) {
      console.error("No Claude API key provided. This script requires AI for categorization.");
      process.exit(1);
    }

    console.log("Using Claude AI for intelligent categorization and deduplication");

    const cosmic = createBucketClient(COSMIC_CONFIG);
    const stats = {
      processed: 0,
      moved: 0,
      standardized: 0,
      removed: 0,
      errors: 0,
      movements: {},
      duplicatesFound: 0,
    };

    // Track existing items for duplicate detection
    const existingItems = {
      genres: new Map(),
      "regular-hosts": new Map(),
      locations: new Map(),
      takeovers: new Map(),
      types: new Map(),
    };

    // First, load existing items for duplicate checking
    console.log("Pre-loading existing items to help AI with categorization and duplicate detection...");
    for (const category of Object.keys(existingItems)) {
      let skip = 0;
      const limit = 100;

      while (true) {
        const response = await cosmic.objects
          .find({
            type: category,
          })
          .props(["id", "title", "slug", "metadata"])
          .limit(limit)
          .skip(skip)
          .depth(1)
          .status("published");

        if (!response.objects || response.objects.length === 0) {
          break;
        }

        for (const item of response.objects) {
          existingItems[category].set(item.title.toLowerCase(), {
            id: item.id,
            title: item.title,
            slug: item.slug,
            processed: false,
          });
        }

        if (response.objects.length < limit) {
          break;
        }
        skip += limit;
      }

      console.log(`Loaded ${existingItems[category].size} items from ${category}`);
    }

    // All categories we want to check
    const categories = ["genres", "regular-hosts", "locations", "takeovers", "types"];

    for (const currentCategory of categories) {
      console.log(`\nProcessing items in "${currentCategory}" category...`);

      let skip = 0;
      const limit = 25; // Smaller batch size since we're making API calls for each item

      while (true) {
        const response = await cosmic.objects
          .find({
            type: currentCategory,
          })
          .props(["id", "title", "slug", "metadata"])
          .limit(limit)
          .skip(skip)
          .depth(1)
          .status("published");

        if (!response.objects || response.objects.length === 0) {
          console.log(`No more items found in "${currentCategory}"`);
          break;
        }

        console.log(`Found ${response.objects.length} items in "${currentCategory}"`);

        // Process items sequentially to avoid hammering the API
        for (const item of response.objects) {
          try {
            const title = item.title;
            stats.processed++;

            // Skip already processed items
            const existingItem = existingItems[currentCategory].get(title.toLowerCase());
            if (existingItem && existingItem.processed) {
              console.log(`Skipping already processed item: "${title}"`);
              continue;
            }

            // Get AI analysis for this item
            console.log(`Analyzing "${title}" with AI...`);
            const result = await analyzeWithAI(title, existingItems);

            // If we couldn't get AI analysis, skip this item
            if (!result) {
              console.log(`Unable to analyze "${title}" with AI, skipping`);
              continue;
            }

            const { category: correctCategory, reason, confidence, standardizedTitle, possibleDuplicates, shouldRemove } = result;

            // Handle items flagged for removal
            if (shouldRemove || correctCategory === "none") {
              console.log(`${dryRun ? "Would remove" : "Removing"} "${title}" (${reason}, confidence: ${confidence})`);

              if (!dryRun) {
                try {
                  await cosmic.objects.deleteOne(item.id);
                  console.log(`Successfully removed "${title}"`);
                  stats.removed++;
                } catch (error) {
                  console.error(`Error removing "${title}":`, error);
                  stats.errors++;
                }
              } else {
                stats.removed++;
              }

              continue; // Skip to next item
            }

            // Check for duplicates
            let isDuplicate = false;
            let duplicateTitle = null;

            if (possibleDuplicates && possibleDuplicates.length > 0) {
              // Look for the duplicate in the target category
              for (const [existingItemTitle, existingItemData] of existingItems[correctCategory].entries()) {
                // Only consider as a duplicate if it's not the same item
                if (item.id !== existingItemData.id && possibleDuplicates.some((dup) => existingItemData.title.toLowerCase() === dup.toLowerCase() || existingItemData.title.toLowerCase().includes(dup.toLowerCase()) || dup.toLowerCase().includes(existingItemData.title.toLowerCase()))) {
                  isDuplicate = true;
                  duplicateTitle = existingItemData.title;
                  break;
                }
              }
            }

            if (isDuplicate) {
              console.log(`AI detected duplicate: "${title}" and "${duplicateTitle}"`);
              stats.duplicatesFound++;

              if (!dryRun) {
                try {
                  // Remove this item since we found a duplicate
                  const deleteResult = await cosmic.objects.deleteOne(item.id);

                  if (deleteResult && deleteResult.message) {
                    console.log(`Removed duplicate "${title}": ${deleteResult.message}`);
                    stats.removed++;
                  } else {
                    console.error(`Strange response when removing duplicate "${title}":`, JSON.stringify(deleteResult));
                    stats.errors++;
                  }
                } catch (error) {
                  console.error(`Error removing duplicate "${title}":`, error.message);
                  if (error.response) {
                    console.error(`Response status: ${error.response.status}`);
                    console.error(`Response data:`, JSON.stringify(error.response.data));
                  }
                  stats.errors++;
                }
              } else {
                stats.removed++;
              }

              continue; // Skip to next item
            }

            // Handle standardization (if item stays in the same category but needs standardization)
            if (standardizedTitle && standardizedTitle !== title && correctCategory === currentCategory) {
              console.log(`${dryRun ? "Would standardize" : "Standardizing"} "${title}" to "${standardizedTitle}"`);

              if (!dryRun) {
                try {
                  // Use the simplest possible update - just pass the object ID and the new title
                  const updateResult = await cosmic.objects.updateOne(item.id, {
                    title: standardizedTitle,
                  });

                  if (updateResult && updateResult.object) {
                    console.log(`Successfully standardized "${title}" to "${standardizedTitle}"`);
                    stats.standardized++;

                    // Update in our tracking
                    existingItems[currentCategory].set(standardizedTitle.toLowerCase(), {
                      id: item.id,
                      title: standardizedTitle,
                      slug: item.slug,
                      processed: true,
                    });
                  } else {
                    console.error(`Strange response when standardizing "${title}":`, JSON.stringify(updateResult));
                    stats.errors++;
                  }
                } catch (error) {
                  console.error(`Error standardizing "${title}":`, error.message);
                  if (error.response) {
                    console.error(`Response status: ${error.response.status}`);
                    console.error(`Response data:`, JSON.stringify(error.response.data));
                  }
                  stats.errors++;
                }
              } else {
                stats.standardized++;
              }

              // Mark original as processed
              if (existingItem) {
                existingItem.processed = true;
              }

              continue; // Skip to next item after standardization
            }

            // Move item if the AI suggests a different category
            if (correctCategory !== currentCategory) {
              const moveKey = `${currentCategory} → ${correctCategory}`;
              stats.movements[moveKey] = (stats.movements[moveKey] || 0) + 1;
              stats.moved++;

              console.log(`${dryRun ? "Would move" : "Moving"} "${title}" from ${currentCategory} to ${correctCategory} (${reason}, confidence: ${confidence})`);

              if (!dryRun) {
                try {
                  // Create the item in the correct category
                  const newTitle = standardizedTitle || title;

                  // Only include title, type and slug to avoid metafield validation errors
                  const insertResult = await cosmic.objects.insertOne({
                    title: newTitle,
                    type: correctCategory,
                    slug: item.slug,
                  });

                  if (insertResult && insertResult.object) {
                    console.log(`Successfully created "${newTitle}" in ${correctCategory} (ID: ${insertResult.object.id})`);

                    // Now delete the original
                    const deleteResult = await cosmic.objects.deleteOne(item.id);

                    if (deleteResult && deleteResult.message) {
                      console.log(`Successfully deleted original "${title}" from ${currentCategory}`);

                      // Update our tracking for future duplicate detection
                      existingItems[correctCategory].set(newTitle.toLowerCase(), {
                        id: insertResult.object.id,
                        title: newTitle,
                        slug: item.slug,
                        processed: true,
                      });

                      console.log(`Successfully moved "${title}" to "${newTitle}" in ${correctCategory}`);

                      if (standardizedTitle && standardizedTitle !== title) {
                        stats.standardized++;
                      }
                    } else {
                      console.error(`Error deleting original after creating new item "${title}":`, JSON.stringify(deleteResult));
                      stats.errors++;
                    }
                  } else {
                    console.error(`Strange response when creating new item for "${title}":`, JSON.stringify(insertResult));
                    stats.errors++;
                  }
                } catch (error) {
                  console.error(`Error moving "${title}":`, error.message);
                  if (error.response) {
                    console.error(`Response status: ${error.response.status}`);
                    console.error(`Response data:`, JSON.stringify(error.response.data));
                  }
                  stats.errors++;
                }
              } else {
                if (standardizedTitle && standardizedTitle !== title) {
                  stats.standardized++;
                }
              }
            } else {
              console.log(`"${title}" is already in the correct category (${currentCategory})`);

              // Mark as processed
              if (existingItem) {
                existingItem.processed = true;
              }
            }

            // Add a small delay to avoid rate limits for the AI API
            await new Promise((resolve) => setTimeout(resolve, 300));
          } catch (error) {
            console.error(`Error processing item "${item.title}":`, error);
            stats.errors++;
          }
        }

        if (response.objects.length < limit) {
          break;
        }
        skip += limit;
      }
    }

    console.log("\nReorganization summary:");
    console.log(`- Total items processed: ${stats.processed}`);
    console.log(`- Items moved: ${stats.moved}`);
    console.log(`- Items standardized: ${stats.standardized}`);
    console.log(`- Items removed: ${stats.removed}`);
    console.log(`- Duplicates found: ${stats.duplicatesFound}`);
    console.log(`- Errors encountered: ${stats.errors}`);

    if (Object.keys(stats.movements).length > 0) {
      console.log("\nCategory movements:");
      for (const [movement, count] of Object.entries(stats.movements)) {
        console.log(`- ${movement}: ${count} items`);
      }
    }

    if (dryRun) {
      console.log("\nThis was a dry run. No changes were made.");
      console.log("Run with --apply to apply changes.");
    } else {
      console.log("\nAll changes have been applied.");
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Update the module exports
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldApply = args.includes("--apply");
  migrateCategories(!shouldApply)
    .then(() => {
      if (shouldApply) {
        console.log("\nChanges have been applied successfully.");
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to run reorganization:", error);
      process.exit(1);
    });
}
