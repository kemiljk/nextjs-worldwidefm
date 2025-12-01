#!/usr/bin/env node

/**
 * Script to assign Gilles Peterson host ID to episodes with "Gilles Peterson" in the title
 *
 * This script:
 * 1. Fetches the regular-hosts object for Gilles Peterson
 * 2. Finds episodes with "Gilles Peterson" in the title that lack this host ID
 * 3. Updates those episodes to include the host reference
 *
 * Usage: bun run scripts/assign-gilles-host.ts [--dry-run]
 */

import { createBucketClient } from '@cosmicjs/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG!,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY!,
  writeKey: process.env.COSMIC_WRITE_KEY!,
});

const GILLES_HOST_ID = '68794cd9d734651042fa6935';
const DRY_RUN = process.argv.includes('--dry-run');

interface HostObject {
  id: string;
  title: string;
  slug: string;
}

interface EpisodeObject {
  id: string;
  title: string;
  slug: string;
  metadata?: {
    regular_hosts?: Array<{ id: string } | string>;
  };
}

async function fetchGillesHost(): Promise<HostObject | null> {
  try {
    console.log(`🔍 Fetching Gilles Peterson host object (ID: ${GILLES_HOST_ID})...`);

    const response = await cosmic.objects.findOne({
      type: 'regular-hosts',
      id: GILLES_HOST_ID,
    });

    if (!response?.object) {
      console.error('❌ Gilles Peterson host object not found');
      return null;
    }

    const host = response.object as HostObject;
    console.log(`✅ Found host: ${host.title} (${host.slug})`);
    return host;
  } catch (error) {
    console.error('❌ Error fetching Gilles Peterson host:', error);
    return null;
  }
}

async function findEpisodesNeedingUpdate(): Promise<EpisodeObject[]> {
  const maxRetries = 3;
  const pageSize = 100; // Smaller page size for reliability
  let allEpisodes: EpisodeObject[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    let lastError: unknown = null;
    let success = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Fetching episodes (skip: ${skip}, limit: ${pageSize})... (attempt ${attempt}/${maxRetries})`);

        const response = await cosmic.objects.find({
          type: 'episode',
          status: 'published',
          title: { $regex: 'Gilles Peterson', $options: 'i' },
        })
          .props('id,title,slug,metadata')
          .depth(2)
          .limit(pageSize)
          .skip(skip);

        const episodes = (response.objects || []) as EpisodeObject[];
        
        if (episodes.length === 0) {
          hasMore = false;
          success = true;
          break;
        }

        allEpisodes.push(...episodes);
        console.log(`📋 Fetched ${episodes.length} episodes (total so far: ${allEpisodes.length})`);

        // Check if we got fewer than pageSize, meaning we're done
        if (episodes.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
        }

        success = true;
        break;
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Attempt ${attempt} failed: ${errorMessage}`);
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!success) {
      console.error('❌ Error fetching episodes after all retries:', lastError);
      console.log(`📊 Processed ${allEpisodes.length} episodes before error`);
      break;
    }

    // Add a small delay between pages to avoid rate limiting
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📋 Total episodes found: ${allEpisodes.length}`);

  const episodesNeedingUpdate = allEpisodes.filter(episode => {
    const hosts = episode.metadata?.regular_hosts || [];
    const hasGilles = hosts.some(host => {
      const hostId = typeof host === 'string' ? host : host.id;
      return hostId === GILLES_HOST_ID;
    });
    return !hasGilles;
  });

  console.log(`📝 Found ${episodesNeedingUpdate.length} episodes that need the host ID assigned`);
  return episodesNeedingUpdate;
}

async function assignHostToEpisodes(episodes: EpisodeObject[], host: HostObject) {
  const results = {
    updated: 0,
    failed: 0,
    errors: [] as string[],
  };

  console.log(`\n🔧 Processing ${episodes.length} episodes...`);

  for (const episode of episodes) {
    try {
      console.log(`\n🎯 Processing: ${episode.title} (${episode.slug})`);

      const currentHosts = episode.metadata?.regular_hosts || [];
      const hostIds = currentHosts.map(h => (typeof h === 'string' ? h : h.id));
      
      if (hostIds.includes(GILLES_HOST_ID)) {
        console.log(`   ⏭️  Already has Gilles Peterson host ID, skipping`);
        continue;
      }

      const updatedHosts = [...hostIds, GILLES_HOST_ID];

      if (DRY_RUN) {
        console.log(`   🔍 [DRY RUN] Would update with host IDs: ${updatedHosts.join(', ')}`);
        results.updated++;
      } else {
        await cosmic.objects.updateOne(episode.id, {
          metadata: {
            regular_hosts: updatedHosts,
          },
        });

        console.log(`   ✅ Updated with Gilles Peterson host ID`);
        results.updated++;
      }
    } catch (error) {
      console.error(`   ❌ Error updating ${episode.title}:`, error);
      results.failed++;
      results.errors.push(
        `${episode.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return results;
}

async function main() {
  console.log('🎵 Assign Gilles Peterson Host Script');
  console.log('=====================================\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const requiredEnvVars = [
    'NEXT_PUBLIC_COSMIC_BUCKET_SLUG',
    'NEXT_PUBLIC_COSMIC_READ_KEY',
    'COSMIC_WRITE_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(envVar => console.error(`  - ${envVar}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  try {
    const host = await fetchGillesHost();
    if (!host) {
      console.error('❌ Could not fetch Gilles Peterson host object');
      process.exit(1);
    }

    const episodes = await findEpisodesNeedingUpdate();
    if (episodes.length === 0) {
      console.log('✅ No episodes need updating');
      return;
    }

    const results = await assignHostToEpisodes(episodes, host);

    console.log('\n📊 Summary:');
    console.log(`  ✅ ${results.updated} episode(s) ${DRY_RUN ? 'would be' : ''} updated`);
    console.log(`  ❌ ${results.failed} episode(s) failed`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (DRY_RUN) {
      console.log('\n💡 Run without --dry-run to apply changes');
    }

    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main();

