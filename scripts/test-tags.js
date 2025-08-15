require("dotenv").config();
const axios = require("axios");

const config = {
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
};

async function testTags() {
  console.log("🏷️ Testing Tags in Craft CMS...");

  try {
    const query = `
      query {
        tags {
          id
          title
          slug
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
      console.log("❌ GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
      return;
    }

    const tags = response.data.data.tags || [];
    console.log(`✅ Found ${tags.length} tags:`);

    tags.forEach((tag) => {
      console.log(`   - ${tag.title} (${tag.slug})`);
    });

    // Look for tags that might indicate collections
    const collectionRelatedTags = tags.filter((tag) => tag.title.toLowerCase().includes("collection") || tag.title.toLowerCase().includes("host") || tag.title.toLowerCase().includes("show") || tag.title.toLowerCase().includes("radio") || tag.title.toLowerCase().includes("music"));

    if (collectionRelatedTags.length > 0) {
      console.log(`\n🎯 Collection-related tags found:`);
      collectionRelatedTags.forEach((tag) => {
        console.log(`   - ${tag.title} (${tag.slug})`);
      });
    } else {
      console.log(`\n❌ No collection-related tags found`);
    }
  } catch (error) {
    console.error("❌ Error testing tags:", error.message);
  }
}

async function main() {
  await testTags();
}

if (require.main === module) {
  main().catch(console.error);
}
