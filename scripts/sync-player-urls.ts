#!/usr/bin/env node

/**
 * Local script to sync player URLs from Craft CMS to Cosmic CMS
 *
 * This script:
 * 1. Fetches all episodes from Craft CMS
 * 2. Finds migrated episodes in Cosmic that need player URL updates
 * 3. Updates Cosmic episodes with player URLs from Craft
 *
 * Usage: bun run scripts/sync-player-urls.ts
 */

import { createBucketClient } from '@cosmicjs/sdk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG!,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY!,
  writeKey: process.env.COSMIC_WRITE_KEY!,
});

async function fetchEpisodesFromCraft(limit: number = 1000) {
  try {
    console.log(`🔍 Fetching episodes from Craft CMS...`);

    const query = `
      query {
        entries(type: "episode", limit: ${limit}) {
          id
          title
          slug
          player
          dateUpdated
        }
      }
    `;

    const response = await fetch(process.env.CRAFT_GRAPHQL_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      throw new Error(JSON.stringify(data.errors, null, 2));
    }

    const episodes = data.data.entries || [];
    console.log(`✅ Found ${episodes.length} episodes from Craft CMS`);

    return episodes;
  } catch (error) {
    console.error('❌ Failed to fetch episodes from Craft:', error);
    return [];
  }
}

async function getCosmicEpisodesNeedingPlayerUrls() {
  try {
    console.log('🔍 Fetching migrated episodes from Cosmic that need player URL updates...');

    const response = await cosmic.objects.find({
      type: 'episode',
      status: 'published',
      'metadata.source': 'migrated_from_craft',
      limit: 1000,
      props: 'id,title,slug,metadata',
    });

    const episodes = response.objects || [];

    // Filter episodes that either have no player URL or have an empty player URL
    const episodesNeedingUpdate = episodes.filter((episode: any) => {
      const currentPlayerUrl = episode.metadata?.player;
      return !currentPlayerUrl || currentPlayerUrl.trim() === '';
    });

    console.log(`📋 Found ${episodesNeedingUpdate.length} episodes needing player URL updates`);
    return episodesNeedingUpdate;
  } catch (error) {
    console.error('❌ Error fetching Cosmic episodes:', error);
    return [];
  }
}

async function syncPlayerUrls() {
  try {
    console.log('🚀 Starting player URL sync process...');

    // Get episodes from Craft CMS
    const craftEpisodes = await fetchEpisodesFromCraft(1000);
    if (craftEpisodes.length === 0) {
      console.log('⚠️ No episodes found in Craft CMS');
      return { updated: 0, failed: 0, errors: [] };
    }

    // Get episodes from Cosmic that need player URL updates
    const cosmicEpisodes = await getCosmicEpisodesNeedingPlayerUrls();
    if (cosmicEpisodes.length === 0) {
      console.log('✅ No episodes in Cosmic need player URL updates');
      return { updated: 0, failed: 0, errors: [] };
    }

    // Create a map of Craft episodes by slug for quick lookup
    const craftEpisodesMap = new Map();
    craftEpisodes.forEach((episode: any) => {
      craftEpisodesMap.set(episode.slug, episode);
    });

    console.log(`🔧 Processing ${cosmicEpisodes.length} episodes for player URL updates...`);

    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const cosmicEpisode of cosmicEpisodes) {
      try {
        console.log(`\n🎯 Processing: ${cosmicEpisode.title} (${cosmicEpisode.slug})`);

        // Find matching Craft episode
        const craftEpisode = craftEpisodesMap.get(cosmicEpisode.slug);

        if (!craftEpisode) {
          console.log(`   ⚠️ No matching Craft episode found for: ${cosmicEpisode.slug}`);
          results.errors.push(`${cosmicEpisode.title}: No matching Craft episode found`);
          results.failed++;
          continue;
        }

        // Check if Craft episode has a player URL
        const craftPlayerUrl = craftEpisode.player;
        if (!craftPlayerUrl || craftPlayerUrl.trim() === '') {
          console.log(`   ⚠️ Craft episode has no player URL: ${cosmicEpisode.slug}`);
          results.errors.push(`${cosmicEpisode.title}: Craft episode has no player URL`);
          results.failed++;
          continue;
        }

        // Update Cosmic episode with player URL from Craft
        await cosmic.objects.updateOne(cosmicEpisode.id, {
          metadata: {
            player: craftPlayerUrl,
          },
        });

        console.log(`   ✅ Updated player URL for: ${cosmicEpisode.title}`);
        console.log(`   📺 Player URL: ${craftPlayerUrl}`);
        results.updated++;
      } catch (error) {
        console.error(`   ❌ Error updating ${cosmicEpisode.title}:`, error);
        results.failed++;
        results.errors.push(
          `${cosmicEpisode.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.log('\n📊 Player URL sync complete:');
    console.log(`  ✅ Updated: ${results.updated}`);
    console.log(`  ❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach((error) => console.log(`  - ${error}`));
    }

    return results;
  } catch (error) {
    console.error('❌ Error in player URL sync process:', error);
    return {
      updated: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function main() {
  console.log('🎵 Player URL Sync Script');
  console.log('========================\n');

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_COSMIC_BUCKET_SLUG',
    'NEXT_PUBLIC_COSMIC_READ_KEY',
    'COSMIC_WRITE_KEY',
    'CRAFT_GRAPHQL_URL',
  ];

  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach((envVar) => console.error(`  - ${envVar}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  try {
    const results = await syncPlayerUrls();

    console.log('\n🎉 Script completed successfully!');
    console.log(`📈 Summary: ${results.updated} updated, ${results.failed} failed`);

    if (results.failed > 0) {
      console.log('\n⚠️ Some episodes failed to update. Check the errors above for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
