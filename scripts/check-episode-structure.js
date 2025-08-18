const axios = require("axios");
require("dotenv").config();

const config = {
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
};

async function checkEpisodeStructure() {
  try {
    console.log("🔍 Checking Craft CMS Episode structure via GraphQL...");

    // Get episodes using the working entries query
    console.log("\n🔍 Getting episodes with entries query...");
    const episodesQuery = `
      query {
        entries(type: "episode", limit: 5) {
          id
          title
          slug
          broadcastDate
          broadcastTime
          duration
          description
          thumbnail {
            url
            filename
            id
          }
          tracklist
          bodyText
          categories {
            id
            title
            slug
            groupId
          }
          locations {
            id
            title
            slug
          }
          hosts {
            id
            title
            slug
          }
          takeovers {
            id
            title
            slug
          }
          featuredOnHomepage
          player
          dateCreated
          dateUpdated
        }
      }
    `;

    const episodesResponse = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: episodesQuery },
      timeout: 30000,
    });

    if (episodesResponse.data.errors) {
      console.error("Episodes query errors:", JSON.stringify(episodesResponse.data.errors, null, 2));
    } else {
      const episodes = episodesResponse.data.data.entries || [];
      console.log(`✅ Found ${episodes.length} episodes from Craft CMS`);

      if (episodes.length > 0) {
        console.log("\n📋 Sample Episode Structure:");
        console.log(JSON.stringify(episodes[0], null, 2));
      }
    }

    // Check for episodes after the last migrated date
    // Starting from Cousin Kula episode from 2025-07-24T11:00:00+00:00
    const lastMigratedDate = "2025-07-24T11:00:00+00:00";
    console.log(`\n🔍 Looking for episodes after: ${lastMigratedDate}`);

    const recentEpisodesQuery = `
      query {
        entries(type: "episode", broadcastDate: ">${lastMigratedDate}", limit: 10) {
          id
          title
          slug
          broadcastDate
          broadcastTime
          thumbnail {
            url
            filename
          }
          categories {
            id
            title
            slug
            groupId
          }
        }
      }
    `;

    const recentResponse = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: recentEpisodesQuery },
      timeout: 30000,
    });

    if (recentResponse.data.errors) {
      console.error("Recent episodes GraphQL Errors:", JSON.stringify(recentResponse.data.errors, null, 2));
    } else {
      const recentEpisodes = recentResponse.data.data.entries || [];
      console.log(`\n📅 Found ${recentEpisodes.length} episodes after ${lastMigratedDate}:`);

      recentEpisodes.forEach((episode) => {
        console.log(`   - ${episode.title} (${episode.broadcastDate}) - ${episode.thumbnail ? "Has image" : "No image"}`);
      });
    }

    // Get total count
    console.log("\n📊 Getting total episode count...");
    const countQuery = `
      query {
        entryCount(type: "episode")
      }
    `;

    const countResponse = await axios({
      url: config.craft.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query: countQuery },
      timeout: 30000,
    });

    if (countResponse.data.errors) {
      console.log("Count query errors:", countResponse.data.errors[0]?.message);
    } else {
      const totalCount = countResponse.data.data.entryCount;
      console.log(`📊 Total episodes available: ${totalCount}`);
    }
  } catch (error) {
    console.error("❌ Failed to check episode structure:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

if (require.main === module) {
  checkEpisodeStructure().catch(console.error);
}

module.exports = { checkEpisodeStructure };
