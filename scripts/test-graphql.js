require("dotenv").config();
const axios = require("axios");

const config = {
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
};

async function testGraphQLEndpoint() {
  console.log("🔍 Testing GraphQL endpoint...");
  console.log("📡 URL:", config.craft.apiUrl);

  try {
    // Test 1: Basic introspection query
    console.log("\n=== Test 1: Schema Introspection ===");
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            fields {
              name
              type {
                name
                ofType {
                  name
                }
              }
            }
          }
        }
      }
    `;

    const introspectionResponse = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: introspectionQuery },
      timeout: 30000,
    });

    if (introspectionResponse.data.errors) {
      console.log("❌ Introspection errors:", JSON.stringify(introspectionResponse.data.errors, null, 2));
    } else {
      console.log("✅ Introspection successful!");

      // Look for relevant types
      const types = introspectionResponse.data.data.__schema.types;
      const relevantTypes = types.filter((type) => type.name.toLowerCase().includes("category") || type.name.toLowerCase().includes("entry") || type.name.toLowerCase().includes("asset") || type.name.toLowerCase().includes("collection") || type.name.toLowerCase().includes("tag"));

      console.log("\n🔍 Relevant types found:");
      relevantTypes.forEach((type) => {
        console.log(`   - ${type.name}`);
        if (type.fields) {
          const relevantFields = type.fields.filter((field) => field.name.toLowerCase().includes("title") || field.name.toLowerCase().includes("slug") || field.name.toLowerCase().includes("thumbnail") || field.name.toLowerCase().includes("image") || field.name.toLowerCase().includes("tag"));
          if (relevantFields.length > 0) {
            console.log(`     Fields: ${relevantFields.map((f) => f.name).join(", ")}`);
          }
        }
      });
    }

    // Test 2: Try to get categories
    console.log("\n=== Test 2: Categories Query ===");
    const categoriesQueries = [
      `
        query {
          categories {
            id
            title
            slug
          }
        }
      `,
      `
        query {
          categories(groupHandle: "collectionCategories") {
            id
            title
            slug
          }
        }
      `,
      `
        query {
          categoryGroups {
            id
            name
            handle
          }
        }
      `,
    ];

    for (let i = 0; i < categoriesQueries.length; i++) {
      try {
        console.log(`   🔍 Trying categories query ${i + 1}...`);
        const response = await axios({
          url: config.craft.apiUrl,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data: { query: categoriesQueries[i] },
          timeout: 30000,
        });

        if (response.data.errors) {
          console.log(`   ⚠️ Query ${i + 1} errors:`, response.data.errors[0]?.message);
        } else {
          console.log(`   ✅ Query ${i + 1} successful!`);
          console.log(`   📊 Response structure:`, Object.keys(response.data.data));
          if (response.data.data.categories) {
            console.log(`   📦 Found ${response.data.data.categories.length} categories`);
            if (response.data.data.categories.length > 0) {
              console.log(`   📝 Sample category:`, response.data.data.categories[0]);
            }
          }
          if (response.data.data.categoryGroups) {
            console.log(`   🏷️ Found ${response.data.data.categoryGroups.length} category groups`);
            if (response.data.data.categoryGroups.length > 0) {
              console.log(`   📝 Sample group:`, response.data.data.categoryGroups[0]);
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Query ${i + 1} failed:`, error.message);
      }
    }

    // Test 3: Try to get entries
    console.log("\n=== Test 3: Entries Query ===");
    const entriesQueries = [
      `
        query {
          entries {
            id
            title
            slug
          }
        }
      `,
      `
        query {
          entries(section: "episode") {
            id
            title
            slug
          }
        }
      `,
      `
        query {
          entries(section: "episode", limit: 5) {
            id
            title
            slug
            episodeCollection {
              id
              title
              slug
            }
          }
        }
      `,
    ];

    for (let i = 0; i < entriesQueries.length; i++) {
      try {
        console.log(`   🔍 Trying entries query ${i + 1}...`);
        const response = await axios({
          url: config.craft.apiUrl,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data: { query: entriesQueries[i] },
          timeout: 30000,
        });

        if (response.data.errors) {
          console.log(`   ⚠️ Query ${i + 1} errors:`, response.data.errors[0]?.message);
        } else {
          console.log(`   ✅ Query ${i + 1} successful!`);
          console.log(`   📊 Response structure:`, Object.keys(response.data.data));
          if (response.data.data.entries) {
            console.log(`   📝 Found ${response.data.data.entries.length} entries`);
            if (response.data.data.entries.length > 0) {
              console.log(`   📄 Sample entry:`, response.data.data.entries[0]);
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Query ${i + 1} failed:`, error.message);
      }
    }

    // Test 4: Try to get assets
    console.log("\n=== Test 4: Assets Query ===");
    const assetsQuery = `
      query {
        assets(limit: 5) {
          id
          url
          filename
          title
        }
      }
    `;

    try {
      console.log("   🔍 Trying assets query...");
      const response = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: assetsQuery },
        timeout: 30000,
      });

      if (response.data.errors) {
        console.log("   ⚠️ Assets query errors:", response.data.errors[0]?.message);
      } else {
        console.log("   ✅ Assets query successful!");
        console.log("   📊 Response structure:", Object.keys(response.data.data));
        if (response.data.data.assets) {
          console.log("   🖼️ Found", response.data.data.assets.length, "assets");
          if (response.data.data.assets.length > 0) {
            console.log("   📸 Sample asset:", response.data.data.assets[0]);
          }
        }
      }
    } catch (error) {
      console.log("   ❌ Assets query failed:", error.message);
    }

    // Test 5: Try to get tags
    console.log("\n=== Test 5: Tags Query ===");
    const tagsQueries = [
      `
        query {
          tags {
            id
            title
            slug
          }
        }
      `,
      `
        query {
          tagGroups {
            id
            name
            handle
          }
        }
      `,
      `
        query {
          tags(groupHandle: "collection") {
            id
            title
            slug
          }
        }
      `,
      `
        query {
          tags(groupHandle: "collections") {
            id
            title
            slug
          }
        }
      `,
    ];

    for (let i = 0; i < tagsQueries.length; i++) {
      try {
        console.log(`   🔍 Trying tags query ${i + 1}...`);
        const response = await axios({
          url: config.craft.apiUrl,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data: { query: tagsQueries[i] },
          timeout: 30000,
        });

        if (response.data.errors) {
          console.log(`   ⚠️ Query ${i + 1} errors:`, response.data.errors[0]?.message);
        } else {
          console.log(`   ✅ Query ${i + 1} successful!`);
          console.log(`   📊 Response structure:`, Object.keys(response.data.data));
          if (response.data.data.tags) {
            console.log(`   🏷️ Found ${response.data.data.tags.length} tags`);
            if (response.data.data.tags.length > 0) {
              console.log(`   📝 Sample tag:`, response.data.data.tags[0]);
            }
          }
          if (response.data.data.tagGroups) {
            console.log(`   🏷️ Found ${response.data.data.tagGroups.length} tag groups`);
            if (response.data.data.tagGroups.length > 0) {
              console.log(`   📝 Sample tag group:`, response.data.data.tagGroups[0]);
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Query ${i + 1} failed:`, error.message);
      }
    }

    // Test 6: Categories with Tags Query
    console.log("\n=== Test 6: Categories with Tags Query ===");
    const categoriesWithTagsQuery = `
      query {
        categories(limit: 10) {
          id
          title
          slug
          tags {
            id
            title
            slug
          }
        }
      }
    `;

    try {
      console.log("   🔍 Trying categories with tags query...");
      const response = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: categoriesWithTagsQuery },
        timeout: 30000,
      });

      if (response.data.errors) {
        console.log("   ⚠️ Categories with tags query errors:", response.data.errors[0]?.message);
      } else {
        console.log("   ✅ Categories with tags query successful!");
        if (response.data.data.categories) {
          console.log(`   📦 Found ${response.data.data.categories.length} categories with tags`);
          // Look for categories with "Collection" tags
          const collectionCategories = response.data.data.categories.filter((cat) => cat.tags && cat.tags.some((tag) => tag.title.toLowerCase().includes("collection") || tag.slug.toLowerCase().includes("collection")));
          if (collectionCategories.length > 0) {
            console.log(`   🎯 Found ${collectionCategories.length} categories with Collection tags:`);
            collectionCategories.forEach((cat) => {
              const collectionTags = cat.tags.filter((tag) => tag.title.toLowerCase().includes("collection") || tag.slug.toLowerCase().includes("collection"));
              console.log(`     - ${cat.title}: ${collectionTags.map((t) => t.title).join(", ")}`);
            });
          }
        }
      }
    } catch (error) {
      console.log("   ❌ Categories with tags query failed:", error.message);
    }

    // Test 7: Look for Collection Entries
    console.log("\n=== Test 7: Collection Entries Query ===");
    const collectionEntriesQueries = [
      `
        query {
          entries(section: "collection") {
            id
            title
            slug
            thumbnail {
              url
              filename
              id
            }
          }
        }
      `,
      `
        query {
          entries(section: "collections") {
            id
            title
            slug
            thumbnail {
              url
              filename
              id
            }
          }
        }
      `,
      `
        query {
          entries(section: "collection", limit: 10) {
            id
            title
            slug
            thumbnail {
              url
              filename
              id
            }
          }
        }
      `,
      `
        query {
          entries(limit: 100) {
            id
            title
            slug
            ... on collection_default_Entry {
              thumbnail {
                url
                filename
                id
              }
            }
            ... on collections_default_Entry {
              thumbnail {
                url
                filename
                id
              }
            }
          }
        }
      `
    ];

    for (let i = 0; i < collectionEntriesQueries.length; i++) {
      try {
        console.log(`   🔍 Trying collection entries query ${i + 1}...`);
        const response = await axios({
          url: config.craft.apiUrl,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data: { query: collectionEntriesQueries[i] },
          timeout: 30000,
        });

        if (response.data.errors) {
          console.log(`   ⚠️ Query ${i + 1} errors:`, response.data.errors[0]?.message);
        } else {
          console.log(`   ✅ Query ${i + 1} successful!`);
          console.log(`   📊 Response structure:`, Object.keys(response.data.data));
          if (response.data.data.entries) {
            console.log(`   📝 Found ${response.data.data.entries.length} entries`);
            
            // Look for entries with images
            const entriesWithImages = response.data.data.entries.filter(entry => 
              entry.thumbnail && entry.thumbnail.url
            );
            console.log(`   🖼️ ${entriesWithImages.length} entries have images`);
            
            if (entriesWithImages.length > 0) {
              console.log(`   📸 Sample entries with images:`);
              entriesWithImages.slice(0, 5).forEach(entry => {
                console.log(`     - ${entry.title} (${entry.slug}): ${entry.thumbnail.filename}`);
              });
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Query ${i + 1} failed:`, error.message);
      }
    }

    // Test 8: Check what sections exist
    console.log("\n=== Test 8: Available Sections Query ===");
    const sectionsQuery = `
      query {
        entries(limit: 1000) {
          id
          title
          slug
          sectionHandle
        }
      }
    `;

    try {
      console.log("   🔍 Trying sections query...");
      const response = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: sectionsQuery },
        timeout: 30000,
      });

      if (response.data.errors) {
        console.log("   ⚠️ Sections query errors:", response.data.errors[0]?.message);
      } else {
        console.log("   ✅ Sections query successful!");
        if (response.data.data.entries) {
          // Extract unique section handles
          const sectionHandles = [...new Set(response.data.data.entries.map(entry => entry.sectionHandle))];
          console.log(`   📋 Found ${sectionHandles.length} unique sections:`);
          sectionHandles.forEach(handle => {
            const count = response.data.data.entries.filter(entry => entry.sectionHandle === handle).length;
            console.log(`     - ${handle}: ${count} entries`);
          });
        }
      }
    } catch (error) {
      console.log("   ❌ Sections query failed:", error.message);
    }

    // Test 9: Look for categories with more fields
    console.log("\n=== Test 9: Categories with More Fields Query ===");
    const categoriesWithMoreFieldsQuery = `
      query {
        categories(limit: 10) {
          id
          title
          slug
          thumbnail {
            url
            filename
            id
          }
          groupHandle
          groupId
        }
      }
    `;

    try {
      console.log("   🔍 Trying categories with more fields query...");
      const response = await axios({
        url: config.craft.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: categoriesWithMoreFieldsQuery },
        timeout: 30000,
      });

      if (response.data.errors) {
        console.log("   ⚠️ Categories with more fields query errors:", response.data.errors[0]?.message);
      } else {
        console.log("   ✅ Categories with more fields query successful!");
        if (response.data.data.categories) {
          console.log(`   📦 Found ${response.data.data.categories.length} categories with more fields`);
          response.data.data.categories.forEach(cat => {
            console.log(`     - ${cat.title} (${cat.slug}): groupHandle=${cat.groupHandle}, groupId=${cat.groupId}`);
          });
        }
      }
    } catch (error) {
      console.log("   ❌ Categories with more fields query failed:", error.message);
    }
  } catch (error) {
    console.error("❌ Error testing GraphQL endpoint:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function main() {
  console.log("🧪 Starting GraphQL endpoint testing...");
  await testGraphQLEndpoint();
  console.log("\n🎉 GraphQL testing completed!");
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testGraphQLEndpoint };
