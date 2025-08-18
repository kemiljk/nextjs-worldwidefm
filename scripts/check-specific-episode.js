const axios = require("axios");

const CRAFT_CONFIG = {
  apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
};

async function checkSpecificEpisode() {
  try {
    console.log("🔍 Checking specific episode with maximum depth...");

    // Query the specific episode with maximum depth
    const episodeQuery = `
      query {
        entry(type: "episode", slug: "no-problemo-listens") {
          id
          title
          slug
          broadcastDate
          broadcastTime
          duration
          description
          bodyText
          # Check ALL possible fields with maximum depth
          categories {
            id
            title
            slug
            groupId
            description
            parentId
            level
            # Check if categories have their own metadata
            metadata
          }
          # Check alternative genre fields
          genreTags {
            id
            title
            slug
            # Try to get any properties that might exist
            _all
          }
          genres
          tags
          # Check other category fields
          episodeCategories
          showCategories
          # Check for any other fields that might contain genre info
          metadata
          customFields
          # Check for any other fields that might exist
          relatedEntries
          relatedCategories
          # Check for any other possible fields
          _all
        }
      }
    `;

    console.log("📡 Querying episode: no problemo #27: pedro montenegro w/ Wolfgang Pérez");
    console.log("🔍 Using maximum depth to see all available data...");

    const response = await axios({
      url: CRAFT_CONFIG.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: episodeQuery },
      timeout: 30000,
    });

    if (response.data.errors) {
      console.error("❌ GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
      return;
    }

    const episode = response.data.data.entry;

    if (!episode) {
      console.log("❌ Episode not found");
      return;
    }

    console.log("\n📺 Episode Data Found:");
    console.log(`   Title: ${episode.title}`);
    console.log(`   Slug: ${episode.slug}`);
    console.log(`   ID: ${episode.id}`);
    console.log(`   Broadcast Date: ${episode.broadcastDate}`);

    // Check categories in detail
    console.log("\n📂 Categories Analysis:");
    if (episode.categories && episode.categories.length > 0) {
      console.log(`   ✅ Found ${episode.categories.length} categories:`);
      episode.categories.forEach((cat, index) => {
        console.log(`     ${index + 1}. ${cat.title}`);
        console.log(`        ID: ${cat.id}`);
        console.log(`        Slug: ${cat.slug}`);
        console.log(`        Group ID: ${cat.groupId}`);
        console.log(`        Description: ${cat.description || "None"}`);
        console.log(`        Parent ID: ${cat.parentId || "None"}`);
        console.log(`        Level: ${cat.level || "None"}`);
        if (cat.metadata) {
          console.log(`        Metadata: ${JSON.stringify(cat.metadata)}`);
        }
        console.log(`        ---`);
      });
    } else {
      console.log("   ❌ No categories found");
    }

    // Check other genre-related fields
    console.log("\n🎵 Genre-Related Fields:");

    if (episode.genreTags) {
      console.log(`   Genre Tags: ${JSON.stringify(episode.genreTags)}`);
      if (Array.isArray(episode.genreTags) && episode.genreTags.length > 0) {
        console.log(`   ✅ Genre Tags (detailed):`);
        episode.genreTags.forEach((tag, index) => {
          console.log(`     ${index + 1}. ${JSON.stringify(tag)}`);
          // Check if the tag object has any properties
          if (typeof tag === "object" && tag !== null) {
            const tagKeys = Object.keys(tag);
            if (tagKeys.length > 0) {
              console.log(`        Properties: ${tagKeys.join(", ")}`);
              tagKeys.forEach((key) => {
                console.log(`        ${key}: ${JSON.stringify(tag[key])}`);
              });
            } else {
              console.log(`        Empty object (no properties)`);
            }
          }
        });
      }
    } else {
      console.log("   Genre Tags: undefined/null");
    }

    if (episode.genres) {
      console.log(`   Genres: ${JSON.stringify(episode.genres)}`);
    } else {
      console.log("   Genres: undefined/null");
    }

    if (episode.tags) {
      console.log(`   Tags: ${JSON.stringify(episode.tags)}`);
    } else {
      console.log("   Tags: undefined/null");
    }

    if (episode.episodeCategories) {
      console.log(`   Episode Categories: ${JSON.stringify(episode.episodeCategories)}`);
    } else {
      console.log("   Episode Categories: undefined/null");
    }

    if (episode.showCategories) {
      console.log(`   Show Categories: ${JSON.stringify(episode.showCategories)}`);
    } else {
      console.log("   Show Categories: undefined/null");
    }

    // Check for any other fields
    console.log("\n🔍 Other Available Fields:");
    const allFields = Object.keys(episode);
    allFields.forEach((field) => {
      if (!["id", "title", "slug", "broadcastDate", "categories", "genreTags", "genres", "tags", "episodeCategories", "showCategories"].includes(field)) {
        const value = episode[field];
        if (value !== null && value !== undefined) {
          console.log(`   ${field}: ${JSON.stringify(value)}`);
        }
      }
    });

    // Let's also try a different approach - check if there are any relationships at all
    console.log("\n🔍 Checking for any relationships or references...");

    const relationshipsQuery = `
      query {
        entry(type: "episode", slug: "no-problemo-listens") {
          id
          title
          # Try to get ALL possible relationships
          ... on episode_episode_Entry {
            # Check if there are specific fields for this entry type
            categories
            genreTags
            # Check for any other fields that might exist
            _all
          }
        }
      }
    `;

    try {
      const relResponse = await axios({
        url: CRAFT_CONFIG.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: { query: relationshipsQuery },
        timeout: 30000,
      });

      if (!relResponse.data.errors) {
        const relEpisode = relResponse.data.data.entry;
        if (relEpisode) {
          console.log("   ✅ Found additional data with specific entry type query:");
          console.log(`   Categories: ${JSON.stringify(relEpisode.categories)}`);
          console.log(`   Genre Tags: ${JSON.stringify(relEpisode.genreTags)}`);
          if (relEpisode._all) {
            console.log(`   All fields: ${JSON.stringify(relEpisode._all)}`);
          }
        }
      }
    } catch (error) {
      console.log("   Additional query failed:", error.message);
    }
  } catch (error) {
    console.error("❌ Error checking specific episode:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function main() {
  console.log("🔍 Starting specific episode check...");

  try {
    await checkSpecificEpisode();
    console.log("\n🎉 Specific episode check completed!");
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkSpecificEpisode };
