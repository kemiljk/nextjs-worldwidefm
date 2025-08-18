const axios = require("axios");

const config = {
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
};

async function checkEpisodeGenreStructure() {
  try {
    console.log("🔍 Checking episode genre structure from Craft CMS...");

    // Query for multiple episodes to examine their genre structure
    const query = `
      query {
        entries(type: "episode", limit: 10) {
          id
          title
          slug
          categories {
            id
            title
            slug
            groupId
          }
          # Let's check if there are other fields that might contain genre info
          # Check the full episode structure
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

    if (episodes.length === 0) {
      console.log("❌ No episodes found");
      return;
    }

    console.log(`\n📋 Found ${episodes.length} episodes:`);
    episodes.forEach((episode, index) => {
      console.log(`\n   ${index + 1}. ${episode.title}`);
      console.log(`     Slug: ${episode.slug}`);
      console.log(`     ID: ${episode.id}`);

      if (episode.categories && episode.categories.length > 0) {
        console.log(`     Categories (${episode.categories.length}):`);
        episode.categories.forEach((category, catIndex) => {
          console.log(`      ${catIndex + 1}. ID: ${category.id}`);
          console.log(`         Title: ${category.title}`);
          console.log(`         Slug: ${category.slug}`);
          console.log(`         Group ID: ${category.groupId}`);
          console.log(`         ---`);
        });
      } else {
        console.log(`     No categories found for this episode`);
      }
    });

    // Let's also check what category groups exist
    console.log(`\n🔍 Checking available category groups...`);
    const categoryGroupsQuery = `
      query {
        categories(limit: 1000) {
          id
          title
          slug
          groupId
        }
      }
    `;

    const groupsResponse = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: categoryGroupsQuery },
      timeout: 30000,
    });

    if (groupsResponse.data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(groupsResponse.data.errors, null, 2));
      return;
    }

    const allCategories = groupsResponse.data.data.categories || [];

    // Group categories by groupId
    const categoryGroups = {};
    allCategories.forEach((cat) => {
      if (!categoryGroups[cat.groupId]) {
        categoryGroups[cat.groupId] = [];
      }
      categoryGroups[cat.groupId].push(cat);
    });

    console.log(`\n📊 Category Groups Found:`);
    Object.keys(categoryGroups).forEach((groupId) => {
      const categories = categoryGroups[groupId];
      console.log(`\n   Group ${groupId}: ${categories.length} categories`);
      console.log(`   Sample categories:`);
      categories.slice(0, 5).forEach((cat) => {
        console.log(`     - ${cat.title} (${cat.slug})`);
      });
      if (categories.length > 5) {
        console.log(`     ... and ${categories.length - 5} more`);
      }
    });
  } catch (error) {
    console.error("❌ Error checking episode genre structure:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function main() {
  console.log("🔍 Starting episode genre structure check...");

  try {
    await checkEpisodeGenreStructure();
    console.log("\n🎉 Genre structure check completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
