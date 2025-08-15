const fs = require("fs");
const path = require("path");

async function analyzeCategories() {
  try {
    console.log("🔍 Analyzing categories from JSON export...");

    // Read the JSON file
    const jsonPath = path.join(__dirname, "categories.json");
    const jsonData = fs.readFileSync(jsonPath, "utf8");
    const categories = JSON.parse(jsonData);

    console.log(`✅ Loaded ${categories.length} total categories from JSON`);

    // Group by groupId
    const categoriesByGroup = {};
    categories.forEach((category) => {
      const groupId = category.groupId;
      if (!categoriesByGroup[groupId]) {
        categoriesByGroup[groupId] = [];
      }
      categoriesByGroup[groupId].push(category);
    });

    console.log("\n📊 Categories by group:");
    Object.keys(categoriesByGroup).forEach((groupId) => {
      const groupCategories = categoriesByGroup[groupId];
      const withThumbnails = groupCategories.filter((cat) => cat.thumbnail && cat.thumbnail.length > 0);
      const withDescriptions = groupCategories.filter((cat) => cat.description && cat.description.trim() !== "");

      console.log(`🔍 Group ${groupId}: ${groupCategories.length} categories`);
      console.log(`   📸 ${withThumbnails.length} have thumbnails`);
      console.log(`   📝 ${withDescriptions.length} have descriptions`);

      // Show first few examples
      if (withThumbnails.length > 0) {
        console.log(`   📸 Examples with thumbnails:`);
        withThumbnails.slice(0, 3).forEach((cat) => {
          console.log(`     - ${cat.title}: thumbnail IDs: [${cat.thumbnail.join(", ")}]`);
        });
      }

      if (withDescriptions.length > 0) {
        console.log(`   📝 Examples with descriptions:`);
        withDescriptions.slice(0, 2).forEach((cat) => {
          const desc = cat.description.length > 100 ? cat.description.substring(0, 100) + "..." : cat.description;
          console.log(`     - ${cat.title}: ${desc}`);
        });
      }
    });

    // Focus on groupId 2 (collection categories)
    const collectionCategories = categoriesByGroup["2"] || [];
    console.log(`\n🎯 Collection Categories (Group 2): ${collectionCategories.length} total`);

    const withThumbnails = collectionCategories.filter((cat) => cat.thumbnail && cat.thumbnail.length > 0);
    const withoutThumbnails = collectionCategories.filter((cat) => !cat.thumbnail || cat.thumbnail.length === 0);

    console.log(`📸 ${withThumbnails.length} have thumbnails`);
    console.log(`❌ ${withoutThumbnails.length} don't have thumbnails`);

    if (withoutThumbnails.length > 0) {
      console.log(`\n🔍 Collection categories without thumbnails (first 10):`);
      withoutThumbnails.slice(0, 10).forEach((cat) => {
        console.log(`   - ${cat.title} (${cat.slug})`);
      });
      if (withoutThumbnails.length > 10) {
        console.log(`   ... and ${withoutThumbnails.length - 10} more`);
      }
    }

    // Check thumbnail structure
    if (withThumbnails.length > 0) {
      console.log(`\n🔍 Thumbnail structure analysis:`);
      const firstWithThumbnail = withThumbnails[0];
      console.log(`   Example: ${firstWithThumbnail.title}`);
      console.log(`   Thumbnail: ${JSON.stringify(firstWithThumbnail.thumbnail, null, 2)}`);
      console.log(`   URI: ${firstWithThumbnail.uri}`);
      console.log(`   URL: ${firstWithThumbnail.url}`);
    }

    // Find categories that might be hosts but aren't in group 2
    console.log(`\n🔍 Looking for potential host categories in other groups...`);
    Object.keys(categoriesByGroup).forEach((groupId) => {
      if (groupId !== "2") {
        const groupCategories = categoriesByGroup[groupId];
        const potentialHosts = groupCategories.filter((cat) => {
          const title = cat.title.toLowerCase();
          const slug = cat.slug.toLowerCase();
          return title.includes("host") || title.includes("dj") || title.includes("artist") || slug.includes("host") || slug.includes("dj") || slug.includes("artist") || title.includes("berlin") || title.includes("venezuela") || slug.includes("berlin") || slug.includes("venezuela");
        });

        if (potentialHosts.length > 0) {
          console.log(`   Group ${groupId}: Found ${potentialHosts.length} potential host categories`);
          potentialHosts.slice(0, 3).forEach((cat) => {
            console.log(`     - ${cat.title} (${cat.slug})`);
          });
        }
      }
    });
  } catch (error) {
    console.error("❌ Error analyzing categories:", error.message);
  }
}

async function main() {
  await analyzeCategories();
  console.log("\n🎉 Categories analysis completed!");
}

if (require.main === module) {
  main().catch(console.error);
}
