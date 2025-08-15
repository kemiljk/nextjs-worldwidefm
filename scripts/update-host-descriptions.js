const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const axios = require("axios");
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

async function fetchCollectionsFromCraft() {
  try {
    console.log("🔍 Fetching Collections from Craft CMS via GraphQL...");

    const query = `
      query {
        categories(limit: 1000) {
          id
          title
          slug
          groupId
          description
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

    const allCategories = response.data.data.categories || [];
    console.log(`✅ Found ${allCategories.length} total categories from Craft CMS`);

    // Filter for only collectionCategories (groupId=2) - these are the actual host collections
    const collectionCategories = allCategories.filter((category) => category.groupId === 2);
    console.log(`🎯 Found ${collectionCategories.length} collection categories (host collections)`);

    // Filter collections that have descriptions
    const collectionsWithDescriptions = collectionCategories.filter((collection) => collection.description && collection.description.trim().length > 0);
    const collectionsWithoutDescriptions = collectionCategories.filter((collection) => !collection.description || collection.description.trim().length === 0);

    console.log(`📝 ${collectionsWithDescriptions.length} collection categories have descriptions`);
    console.log(`❌ ${collectionsWithoutDescriptions.length} collection categories don't have descriptions`);

    // Show some collections without descriptions for debugging
    if (collectionsWithoutDescriptions.length > 0) {
      console.log(`\n🔍 Collection categories without descriptions (first 10):`);
      collectionsWithoutDescriptions.slice(0, 10).forEach((collection) => {
        console.log(`   - ${collection.title} (${collection.slug})`);
      });
      if (collectionsWithoutDescriptions.length > 10) {
        console.log(`   ... and ${collectionsWithoutDescriptions.length - 10} more`);
      }
    }

    return collectionsWithDescriptions;
  } catch (error) {
    console.error("❌ Failed to fetch collections from Craft:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

async function getCosmicRegularHosts() {
  try {
    console.log("📋 Fetching existing regular hosts from Cosmic...");

    const response = await cosmic.objects.find({
      type: "regular-hosts",
      status: "published",
      props: "id,slug,title,metadata",
    });

    const hosts = response.objects || [];
    console.log(`✅ Found ${hosts.length} regular hosts in Cosmic`);

    return hosts;
  } catch (error) {
    console.error("❌ Error fetching Cosmic hosts:", error.message);
    return [];
  }
}

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Check for exact substring matches
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Check for word-level matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  const commonWords = words1.filter((word) => words2.includes(word));
  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  // Simple Levenshtein-like distance for very short strings
  if (s1.length <= 3 || s2.length <= 3) {
    return 0;
  }

  return 0;
}

function findBestMatch(hostTitle, collections, threshold = 0.5) {
  let bestMatch = null;
  let bestScore = 0;

  for (const collection of collections) {
    const score = calculateSimilarity(hostTitle, collection.title);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = collection;
    }
  }

  return { match: bestMatch, score: bestScore };
}

async function updateHostWithDescription(host, collection, description) {
  try {
    console.log(`   🔄 Updating host: ${host.title}`);
    console.log(`   📝 Craft CMS description: ${description}`);
    console.log(`   🎯 Matched collection: ${collection.title} (similarity: ${collection.similarityScore})`);

    console.log(`   📝 Update data:`, JSON.stringify({ description: description }, null, 2));

    // Only update the description field - create minimal metadata with just what we need
    const updateData = {
      metadata: {
        description: description,
      },
    };

    console.log(`   📝 Full update data:`, JSON.stringify(updateData, null, 2));

    // Update the object
    const result = await cosmic.objects.updateOne(host.id, updateData);

    console.log(`   ✅ Successfully updated ${host.title} with description`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating ${host.title}:`, error.message);
    if (error.response) {
      console.error(`   📡 Response status:`, error.response.status);
      console.error(`   📡 Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function processDescriptions() {
  try {
    // Get collections from Craft CMS
    const collections = await fetchCollectionsFromCraft();

    if (collections.length === 0) {
      console.log("❌ No collections found to process");
      return;
    }

    // Get existing hosts from Cosmic
    const cosmicHosts = await getCosmicRegularHosts();

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let noMatch = 0;

    for (const host of cosmicHosts) {
      console.log(`\n🎯 Processing host: ${host.title} (${host.slug})`);

      // Check if host already has a description
      if (host.metadata?.description && host.metadata.description.trim().length > 0) {
        console.log(`   ✅ Host already has description: "${host.metadata.description.substring(0, 100)}..."`);
        skipped++;
        continue;
      }

      // Find best matching collection
      const { match: bestMatch, score: similarityScore } = findBestMatch(host.title, collections);

      if (!bestMatch) {
        console.log(`   ⚠️ No matching collection found for: ${host.title}`);
        noMatch++;
        continue;
      }

      // Add similarity score to collection for logging
      bestMatch.similarityScore = similarityScore;

      // Update host with description
      const success = await updateHostWithDescription(host, bestMatch, bestMatch.description);
      if (success) {
        updated++;
      }

      processed++;
    }

    // Show hosts that still need descriptions
    const hostsWithoutDescriptions = cosmicHosts.filter((host) => !host.metadata?.description || host.metadata.description.trim().length === 0);

    console.log(`\n📊 Processing Summary:`);
    console.log(`   🎯 Total hosts: ${cosmicHosts.length}`);
    console.log(`   ✅ Updated hosts: ${updated}`);
    console.log(`   ⏭️ Skipped (already have descriptions): ${skipped}`);
    console.log(`   ❌ No matching collection: ${noMatch}`);
    console.log(`   📦 Total processed: ${processed}`);
    console.log(`   ❌ Hosts still without descriptions: ${hostsWithoutDescriptions.length}`);

    if (hostsWithoutDescriptions.length > 0) {
      console.log(`\n🔍 Hosts that still need descriptions:`);
      hostsWithoutDescriptions.slice(0, 10).forEach((host) => {
        console.log(`   - ${host.title} (${host.slug})`);
      });
      if (hostsWithoutDescriptions.length > 10) {
        console.log(`   ... and ${hostsWithoutDescriptions.length - 10} more`);
      }
    }

    // Show some examples of successful matches
    if (updated > 0) {
      console.log(`\n🎉 Examples of successful updates:`);
      const updatedHosts = cosmicHosts.filter((host) => host.metadata?.description && host.metadata.description.trim().length > 0);
      updatedHosts.slice(0, 5).forEach((host) => {
        console.log(`   📝 ${host.title}: "${host.metadata.description.substring(0, 100)}..."`);
      });
    }
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

async function main() {
  console.log("🎵 Starting host description update process...");

  try {
    await processDescriptions();
    console.log("\n🎉 Host description update process completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, processDescriptions };
