const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");
const axios = require("axios");

// Validate environment variables
const requiredEnvVars = ["NEXT_PUBLIC_COSMIC_BUCKET_SLUG", "NEXT_PUBLIC_COSMIC_READ_KEY", "COSMIC_WRITE_KEY"];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}

const COSMIC_CONFIG = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

const CRAFT_CONFIG = {
  apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
};

// Initialize Cosmic client
const cosmic = createBucketClient(COSMIC_CONFIG);

async function fetchEpisodeFromCraft(slug) {
  try {
    const query = `
      query {
        entry(type: "episode", slug: "${slug}") {
          id
          title
          slug
          categories {
            id
            title
            slug
            groupId
          }
          genreTags {
            id
            title
            slug
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
        }
      }
    `;

    const response = await axios({
      url: CRAFT_CONFIG.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: { query },
      timeout: 30000,
    });

    if (response.data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
      return null;
    }

    return response.data.data.entry;
  } catch (error) {
    console.error(`❌ Failed to fetch episode ${slug} from Craft:`, error.message);
    return null;
  }
}

async function getCosmicGenres() {
  try {
    console.log("📋 Fetching existing genres from Cosmic...");

    const response = await cosmic.objects.find({
      type: "genres",
      status: "published",
      props: "id,slug,title",
    });

    const genres = response.objects || [];
    console.log(`✅ Found ${genres.length} genres in Cosmic`);

    return genres;
  } catch (error) {
    console.error("❌ Error fetching Cosmic genres:", error.message);
    return [];
  }
}

async function getCosmicLocations() {
  try {
    console.log("📋 Fetching existing locations from Cosmic...");

    const response = await cosmic.objects.find({
      type: "locations",
      status: "published",
      props: "id,slug,title",
    });

    const locations = response.objects || [];
    console.log(`✅ Found ${locations.length} locations in Cosmic`);

    return locations;
  } catch (error) {
    console.error("❌ Error fetching Cosmic locations:", error.message);
    return [];
  }
}

async function getCosmicRegularHosts() {
  try {
    console.log("📋 Fetching existing regular hosts from Cosmic...");

    const response = await cosmic.objects.find({
      type: "regular-hosts",
      status: "published",
      props: "id,slug,title",
    });

    const hosts = response.objects || [];
    console.log(`✅ Found ${hosts.length} regular hosts in Cosmic`);

    return hosts;
  } catch (error) {
    console.error("❌ Error fetching Cosmic regular hosts:", error.message);
    return [];
  }
}

async function getCosmicTakeovers() {
  try {
    console.log("📋 Fetching existing takeovers from Cosmic...");

    const response = await cosmic.objects.find({
      type: "takeovers",
      status: "published",
      props: "id,slug,title",
    });

    const takeovers = response.objects || [];
    console.log(`✅ Found ${takeovers.length} takeovers in Cosmic`);

    return takeovers;
  } catch (error) {
    console.error("❌ Error fetching Cosmic takeovers:", error.message);
    return [];
  }
}

async function findMatchingCosmicObject(items, craftItem, type) {
  if (!craftItem || !craftItem.title) return null;

  // Use case-insensitive title matching for genres
  const matching = items.find((item) => item.title.toLowerCase() === craftItem.title.toLowerCase());

  if (matching) {
    console.log(`   ✅ Found matching ${type}: ${craftItem.title} (ID: ${matching.id})`);
    // Return just the ID for proper object relationships in Cosmic
    return matching.id;
  }

  console.log(`   ⚠️ No matching ${type} found for: ${craftItem.title}`);
  return null;
}

async function updateEpisodeGenres(dryRun = true) {
  try {
    console.log(`🎵 Starting genre update for existing episodes... ${dryRun ? "(DRY RUN)" : ""}`);
    console.log(`📅 Only processing episodes from 2025-07-24T11:00:00+00:00 onwards (Cousin Kula episode)`);

    // Get reference objects from Cosmic
    const cosmicGenres = await getCosmicGenres();
    const cosmicLocations = await getCosmicLocations();
    const cosmicHosts = await getCosmicRegularHosts();
    const cosmicTakeovers = await getCosmicTakeovers();

    const stats = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    let skip = 0;
    const limit = 100;

    while (true) {
      console.log(`\n📄 Fetching episodes batch (skip: ${skip}, limit: ${limit})...`);

      const response = await cosmic.objects.find({
        type: "episode",
        props: "id,slug,title,metadata.genres,metadata.locations,metadata.regular_hosts,metadata.takeovers,metadata.broadcast_date",
        limit: limit,
        skip: skip,
        depth: 1,
        status: "published",
        // Only process episodes from Cousin Kula onwards (2025-07-24T11:00:00+00:00)
        "metadata.broadcast_date": {
          $gte: "2025-07-24T11:00:00+00:00",
        },
      });

      if (!response.objects || response.objects.length === 0) {
        console.log("📄 No more episodes found");
        break;
      }

      const episodes = response.objects;
      console.log(`📄 Processing ${episodes.length} episodes...`);

      for (const episode of episodes) {
        try {
          stats.processed++;

          // Check if episode already has valid genres (empty arrays count as missing, broken relationships need fixing)
          const hasValidGenres = episode.metadata?.genres && 
            episode.metadata.genres.length > 0 && 
            episode.metadata.genres.every(genre => typeof genre === 'string' && genre.length > 0);
          
          const hasValidLocations = episode.metadata?.locations && 
            episode.metadata.locations.length > 0 && 
            episode.metadata.locations.every(loc => typeof loc === 'string' && loc.length > 0);
          
          const hasValidHosts = episode.metadata?.regular_hosts && 
            episode.metadata.regular_hosts.length > 0 && 
            episode.metadata.regular_hosts.every(host => typeof host === 'string' && host.length > 0);
          
          const hasValidTakeovers = episode.metadata?.takeovers && 
            episode.metadata.takeovers.length > 0 && 
            episode.metadata.takeovers.every(takeover => typeof takeover === 'string' && takeover.length > 0);

          // Log current state for debugging
          console.log(`   📊 Current relationships: Genres: ${episode.metadata?.genres?.length || 0}, Locations: ${episode.metadata?.locations?.length || 0}, Hosts: ${episode.metadata?.regular_hosts?.length || 0}, Takeovers: ${episode.metadata?.takeovers?.length || 0}`);
          
          // Check if relationships are broken (exist but are invalid)
          const hasBrokenGenres = episode.metadata?.genres && episode.metadata.genres.length > 0 && !hasValidGenres;
          const hasBrokenLocations = episode.metadata?.locations && episode.metadata.locations.length > 0 && !hasValidLocations;
          const hasBrokenHosts = episode.metadata?.regular_hosts && episode.metadata.regular_hosts.length > 0 && !hasValidHosts;
          const hasBrokenTakeovers = episode.metadata?.takeovers && episode.metadata.takeovers.length > 0 && !hasValidTakeovers;
          
          if (hasBrokenGenres || hasBrokenLocations || hasBrokenHosts || hasBrokenTakeovers) {
            console.log(`   🔧 ${episode.title} has broken relationships that need fixing`);
          } else if (hasValidGenres && hasValidLocations && hasValidHosts && hasValidTakeovers) {
            console.log(`   ⏭️ Skipping ${episode.title} - already has all valid relationships`);
            stats.skipped++;
            continue;
          }

          console.log(`\n🎯 Processing: ${episode.title} (${episode.slug})`);

          // Fetch original data from Craft CMS
          const craftEpisode = await fetchEpisodeFromCraft(episode.slug);
          if (!craftEpisode) {
            console.log(`   ❌ Could not fetch from Craft CMS, skipping`);
            stats.errors++;
            continue;
          }

          // Map genreTags to genres (this is where genres are actually stored in Craft CMS)
          const craftGenres = craftEpisode.genreTags || [];
          console.log(`   🔍 Found ${craftGenres.length} genres in Craft CMS (genreTags):`, craftGenres.map((g) => g.title).join(", "));

          const genres = (await Promise.all(craftGenres.map((tag) => findMatchingCosmicObject(cosmicGenres, tag, "genre")))).filter(Boolean) || [];

          // Map locations
          const craftLocations = craftEpisode.locations || [];
          console.log(`   🌍 Found ${craftLocations.length} locations in Craft CMS:`, craftLocations.map((l) => l.title).join(", "));

          const locations = (await Promise.all(craftLocations.map((loc) => findMatchingCosmicObject(cosmicLocations, loc, "location")))).filter(Boolean) || [];

          // Map hosts
          const craftHosts = craftEpisode.hosts || [];
          console.log(`   👤 Found ${craftHosts.length} hosts in Craft CMS:`, craftHosts.map((h) => h.title).join(", "));

          const hosts = (await Promise.all(craftHosts.map((host) => findMatchingCosmicObject(cosmicHosts, host, "host")))).filter(Boolean) || [];

          // Map takeovers
          const craftTakeovers = craftEpisode.takeovers || [];
          console.log(`   🎭 Found ${craftTakeovers.length} takeovers in Craft CMS:`, craftTakeovers.map((t) => t.title).join(", "));

          const takeovers = (await Promise.all(craftTakeovers.map((takeover) => findMatchingCosmicObject(cosmicTakeovers, takeover, "takeover")))).filter(Boolean) || [];

          // Check if we have new relationships to add or need to fix broken ones
          const hasNewGenres = genres.length > 0 && (!hasValidGenres || hasBrokenGenres);
          const hasNewLocations = locations.length > 0 && (!hasValidLocations || hasBrokenLocations);
          const hasNewHosts = hosts.length > 0 && (!hasValidHosts || hasBrokenHosts);
          const hasNewTakeovers = takeovers.length > 0 && (!hasValidTakeovers || hasBrokenTakeovers);

          if (!hasNewGenres && !hasNewLocations && !hasNewHosts && !hasNewTakeovers) {
            console.log(`   ⏭️ No new relationships to add`);
            stats.skipped++;
            continue;
          }

          console.log(`   📝 Found new relationships:`);
          if (hasNewGenres) console.log(`     🎵 Genres: ${genres.length} (was ${episode.metadata.genres?.length || 0})`);
          if (hasNewLocations) console.log(`     🌍 Locations: ${locations.length} (was ${episode.metadata.locations?.length || 0})`);
          if (hasNewHosts) console.log(`     👤 Hosts: ${hosts.length} (was ${episode.metadata.regular_hosts?.length || 0})`);
          if (hasNewTakeovers) console.log(`     🎭 Takeovers: ${takeovers.length} (was ${episode.metadata.takeovers?.length || 0})`);

          if (!dryRun) {
            // Update the episode with new relationships
            const updateData = {
              metadata: {},
            };

            // Only update fields that have new data
            if (hasNewGenres) updateData.metadata.genres = genres;
            if (hasNewLocations) updateData.metadata.locations = locations;
            if (hasNewHosts) updateData.metadata.regular_hosts = hosts;
            if (hasNewTakeovers) updateData.metadata.takeovers = takeovers;

            const result = await cosmic.objects.updateOne(episode.id, updateData);

            if (result && result.object) {
              console.log(`   ✅ Successfully updated episode`);
              stats.updated++;
            } else {
              console.log(`   ❌ Failed to update episode`);
              stats.errors++;
            }
          } else {
            console.log(`   📝 Would update episode with new relationships`);
            stats.updated++;
          }

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   ❌ Error processing episode ${episode.title}:`, error.message);
          stats.errors++;
        }
      }

      if (episodes.length < limit) break;
      skip += limit;
    }

    console.log("\n📊 Genre Update Summary:");
    console.log(`   🎯 Total episodes processed: ${stats.processed}`);
    console.log(`   ✅ Episodes updated: ${stats.updated}`);
    console.log(`   ⏭️ Episodes skipped: ${stats.skipped}`);
    console.log(`   ❌ Errors: ${stats.errors}`);

    if (dryRun) {
      console.log("\nThis was a dry run. No changes were made.");
      console.log("Run with --apply to apply changes.");
    }

    return stats;
  } catch (error) {
    console.error("❌ Fatal error:", error);
    throw error;
  }
}

async function main() {
  console.log("🎵 Starting existing episode genre update process...");

  try {
    const args = process.argv.slice(2);
    const shouldApply = args.includes("--apply");

    await updateEpisodeGenres(!shouldApply);

    if (shouldApply) {
      console.log("\n🎉 Episode genre updates completed successfully!");
    }
  } catch (error) {
    console.error("❌ Error in main process:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateEpisodeGenres };
