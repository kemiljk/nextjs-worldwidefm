const axios = require("axios");

const CRAFT_CONFIG = {
  apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
};

async function checkEpisodeGraphQLStructure() {
  try {
    console.log("🔍 Checking episode GraphQL structure from Craft CMS...");

    // First, let's check what fields are available on episodes
    console.log("\n📋 Checking available episode fields...");

    const introspectionQuery = `
      query {
        __type(name: "Episode") {
          name
          fields {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    `;

    try {
      const introspectionResponse = await axios({
        url: CRAFT_CONFIG.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: introspectionQuery },
        timeout: 30000,
      });

      if (introspectionResponse.data.errors) {
        console.log("Introspection not available, continuing with direct queries...");
      } else {
        const fields = introspectionResponse.data.data?.__type?.fields || [];
        console.log(`✅ Found ${fields.length} fields on Episode type`);

        // Look for genre-related fields
        const genreFields = fields.filter((field) => field.name.toLowerCase().includes("genre") || field.name.toLowerCase().includes("category") || field.name.toLowerCase().includes("tag"));

        if (genreFields.length > 0) {
          console.log("🎵 Genre-related fields found:");
          genreFields.forEach((field) => {
            console.log(`   - ${field.name}: ${field.type.name || field.type.kind}`);
          });
        }
      }
    } catch (error) {
      console.log("Introspection failed, continuing with direct queries...");
    }

    // Now let's examine a specific episode to see its actual data structure
    console.log("\n🎯 Examining specific episode data structure...");

    // Try to find an episode that might have genre data
    const episodeQuery = `
      query {
        entries(type: "episode", limit: 20) {
          id
          title
          slug
          broadcastDate
          # Check all possible genre-related fields
          categories {
            id
            title
            slug
            groupId
          }
          # Alternative field names that might exist
          genreTags
          genres
          tags
          # Check if there are other category fields
          episodeCategories
          showCategories
          # Check for any other fields that might contain genre info
          metadata
          customFields
        }
      }
    `;

    const episodeResponse = await axios({
      url: CRAFT_CONFIG.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: episodeQuery },
      timeout: 30000,
    });

    if (episodeResponse.data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(episodeResponse.data.errors, null, 2));
      return;
    }

    const episodes = episodeResponse.data.data.entries || [];
    console.log(`✅ Found ${episodes.length} episodes to examine`);

    episodes.forEach((episode, index) => {
      console.log(`\n📺 Episode ${index + 1}: ${episode.title}`);
      console.log(`   Slug: ${episode.slug}`);
      console.log(`   ID: ${episode.id}`);

      // Check categories
      if (episode.categories && episode.categories.length > 0) {
        console.log(`   📂 Categories (${episode.categories.length}):`);
        episode.categories.forEach((cat, catIndex) => {
          console.log(`     ${catIndex + 1}. ${cat.title} (groupId: ${cat.groupId})`);
        });
      } else {
        console.log(`   📂 Categories: None`);
      }

      // Check other possible genre fields
      if (episode.genreTags) {
        console.log(`   🎵 Genre Tags: ${JSON.stringify(episode.genreTags)}`);
        if (Array.isArray(episode.genreTags) && episode.genreTags.length > 0) {
          console.log(`   🎵 Genre Tags (detailed):`);
          episode.genreTags.forEach((tag, tagIndex) => {
            console.log(`     ${tagIndex + 1}. ${JSON.stringify(tag)}`);
          });
        }
      }

      if (episode.genres) {
        console.log(`   🎵 Genres: ${JSON.stringify(episode.genres)}`);
      }

      if (episode.tags) {
        console.log(`   🏷️ Tags: ${JSON.stringify(episode.tags)}`);
      }

      if (episode.episodeCategories) {
        console.log(`   📂 Episode Categories: ${JSON.stringify(episode.episodeCategories)}`);
      }

      if (episode.showCategories) {
        console.log(`   📂 Show Categories: ${JSON.stringify(episode.showCategories)}`);
      }

      if (episode.metadata) {
        console.log(`   📋 Metadata: ${JSON.stringify(episode.metadata)}`);
      }

      if (episode.customFields) {
        console.log(`   🔧 Custom Fields: ${JSON.stringify(episode.customFields)}`);
      }
    });

    // Let's also check what category groups exist and their structure
    console.log("\n🔍 Checking category groups structure...");

    const categoryGroupsQuery = `
      query {
        categories(limit: 100) {
          id
          title
          slug
          groupId
          # Check if there are other fields that might be relevant
          description
          parentId
          level
          # Check for any metadata or custom fields
          metadata
        }
      }
    `;

    const groupsResponse = await axios({
      url: CRAFT_CONFIG.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: categoryGroupsQuery },
      timeout: 30000,
    });

    if (groupsResponse.data.errors) {
      console.error("Category Groups GraphQL Errors:", JSON.stringify(groupsResponse.data.errors, null, 2));
    } else {
      const allCategories = groupsResponse.data.data.categories || [];

      // Group by groupId
      const categoriesByGroup = {};
      allCategories.forEach((cat) => {
        if (!categoriesByGroup[cat.groupId]) {
          categoriesByGroup[cat.groupId] = [];
        }
        categoriesByGroup[cat.groupId].push(cat);
      });

      console.log(`\n📊 Category Groups Found:`);
      Object.keys(categoriesByGroup).forEach((groupId) => {
        const categories = categoriesByGroup[groupId];
        console.log(`\n   Group ${groupId}: ${categories.length} categories`);
        console.log(`   Sample categories:`);
        categories.slice(0, 5).forEach((cat) => {
          console.log(`     - ${cat.title} (${cat.slug})`);
        });
        if (categories.length > 5) {
          console.log(`     ... and ${categories.length - 5} more`);
        }
      });
    }

    // Let's also check if there are any other entry types that might have genre data
    console.log("\n🔍 Checking for other entry types that might have genre data...");

    const entryTypesQuery = `
      query {
        __schema {
          types {
            name
            kind
          }
        }
      }
    `;

    try {
      const entryTypesResponse = await axios({
        url: CRAFT_CONFIG.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: entryTypesQuery },
        timeout: 30000,
      });

      if (!entryTypesResponse.data.errors) {
        const types = entryTypesResponse.data.data.__schema.types || [];
        const entryTypes = types.filter((type) => type.kind === "OBJECT" && type.name.toLowerCase().includes("entry") && type.name !== "Query");

        console.log(`\n📋 Found ${entryTypes.length} entry types:`);
        entryTypes.forEach((type) => {
          console.log(`   - ${type.name}`);
        });
      }
    } catch (error) {
      console.log("Could not fetch entry types schema");
    }
  } catch (error) {
    console.error("❌ Error checking episode GraphQL structure:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function main() {
  console.log("🔍 Starting episode GraphQL structure check...");

  try {
    await checkEpisodeGraphQLStructure();
    console.log("\n🎉 GraphQL structure check completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkEpisodeGraphQLStructure };
