import { createBucketClient } from '@cosmicjs/sdk';
import { extractDatePart, extractTimePart } from '../lib/date-utils';
import * as fs from 'fs/promises';
import * as path from 'path';

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG!,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY!,
  writeKey: process.env.COSMIC_WRITE_KEY!,
});

const CRAFT_GRAPHQL_URL = process.env.CRAFT_GRAPHQL_URL!;
const CUTOFF_DATE = '2025-10-07T00:00:00+00:00';

interface GapReport {
  missing: Array<{ slug: string; title: string; broadcastDate: string }>;
  incomplete: Array<{
    slug: string;
    title: string;
    missingFields: string[];
    craftData: any;
  }>;
}

async function fetchEpisodesFromCraft(limit: number = 500): Promise<any[]> {
  try {
    console.log(`🔍 Fetching episodes from Craft CMS after ${CUTOFF_DATE}...`);

    const query = `
      query {
        entries(type: "episode", broadcastDate: ">${CUTOFF_DATE}", limit: ${limit}) {
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
          featuredOnHomepage
          player
          dateCreated
          dateUpdated
        }
      }
    `;

    const response = await fetch(CRAFT_GRAPHQL_URL, {
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

async function fetchEpisodesFromCosmic(): Promise<{
  bySlug: Map<string, any>;
  byTitle: Map<string, any>;
}> {
  try {
    console.log(`🔍 Fetching episodes from Cosmic CMS after ${CUTOFF_DATE}...`);

    const bySlug = new Map<string, any>();
    const byTitle = new Map<string, any>();
    let page = 1;
    const limit = 100;

    while (true) {
      const response = await cosmic.objects.find({
        type: 'episode',
        status: 'published',
        'metadata.broadcast_date': { $gte: extractDatePart(CUTOFF_DATE) },
        limit,
        skip: (page - 1) * limit,
        props: 'id,slug,title,metadata,thumbnail',
      });

      if (!response.objects || response.objects.length === 0) break;

      response.objects.forEach((episode: any) => {
        if (episode.slug) {
          bySlug.set(episode.slug, episode);
        }
        if (episode.title) {
          const normalizedTitle = episode.title.toLowerCase().trim();
          byTitle.set(normalizedTitle, episode);
        }
      });

      if (response.objects.length < limit) break;
      page++;
    }

    console.log(`✅ Found ${bySlug.size} episodes from Cosmic CMS`);
    return { bySlug, byTitle };
  } catch (error) {
    console.error('❌ Failed to fetch episodes from Cosmic:', error);
    return { bySlug: new Map(), byTitle: new Map() };
  }
}

async function getCosmicGenres() {
  try {
    const response = await cosmic.objects.find({
      type: 'genres',
      status: 'published',
      limit: 1000,
      props: 'id,title,slug',
    });
    return response.objects || [];
  } catch (error) {
    console.error('❌ Error fetching Cosmic genres:', error);
    return [];
  }
}

async function getCosmicLocations() {
  try {
    const response = await cosmic.objects.find({
      type: 'locations',
      status: 'published',
      limit: 1000,
      props: 'id,title,slug',
    });
    return response.objects || [];
  } catch (error) {
    console.error('❌ Error fetching Cosmic locations:', error);
    return [];
  }
}

async function getCosmicRegularHosts() {
  try {
    const response = await cosmic.objects.find({
      type: 'regular-hosts',
      status: 'published',
      limit: 1000,
      props: 'id,title,slug',
    });
    return response.objects || [];
  } catch (error) {
    console.error('❌ Error fetching Cosmic regular hosts:', error);
    return [];
  }
}

async function getCosmicTakeovers() {
  try {
    const response = await cosmic.objects.find({
      type: 'takeovers',
      status: 'published',
      limit: 1000,
      props: 'id,title,slug',
    });
    return response.objects || [];
  } catch (error) {
    console.error('❌ Error fetching Cosmic takeovers:', error);
    return [];
  }
}

function findMatchingCosmicObject(items: any[], craftItem: any): string | null {
  if (!craftItem || !craftItem.title) return null;

  const matching = items.find(
    item => item.title.toLowerCase() === craftItem.title.toLowerCase()
  );

  return matching ? matching.id : null;
}

function hasBroadcastPassed(broadcastDate: string, broadcastTime?: string): boolean {
  try {
    let broadcastDateTime: Date;

    if (broadcastDate.includes('T')) {
      broadcastDateTime = new Date(broadcastDate);
    } else {
      const time = broadcastTime || '00:00';
      broadcastDateTime = new Date(`${broadcastDate}T${time}:00Z`);
    }

    const now = new Date();
    return broadcastDateTime <= now;
  } catch (error) {
    console.error(`Error checking broadcast date: ${broadcastDate}`, error);
    return false;
  }
}

async function processImage(imageUrl: string, filename: string): Promise<any | null> {
  try {
    console.log(`   📸 Processing image: ${filename}`);

    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'WorldwideFM-Migration/1.0',
      },
    });

    if (!response.ok) {
      console.log(`   ⚠️ Could not fetch image: ${response.status}`);
      return null;
    }

    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength > 10 * 1024 * 1024) {
      console.log(
        `   ⚠️ Image too large: ${(imageBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`
      );
      return null;
    }

    const file = {
      originalname: filename,
      buffer: Buffer.from(imageBuffer),
    };

    const mediaResponse = await cosmic.media.insertOne({
      media: file,
    });

    if (mediaResponse && mediaResponse.media) {
      console.log(`   ✅ Successfully processed image: ${filename}`);
      return mediaResponse.media;
    }

    return null;
  } catch (error) {
    console.log(`   ⚠️ Image processing failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function assessGaps(
  craftEpisodes: any[],
  cosmicBySlug: Map<string, any>,
  cosmicByTitle: Map<string, any>
): GapReport {
  const missing: GapReport['missing'] = [];
  const incomplete: GapReport['incomplete'] = [];

  for (const craftEpisode of craftEpisodes) {
    // First try to match by slug (exact match)
    let cosmicEpisode = cosmicBySlug.get(craftEpisode.slug);

    // If no slug match, try matching by title (case-insensitive)
    let matchedByTitle = false;
    if (!cosmicEpisode && craftEpisode.title) {
      const normalizedTitle = craftEpisode.title.toLowerCase().trim();
      cosmicEpisode = cosmicByTitle.get(normalizedTitle);
      
      if (cosmicEpisode) {
        matchedByTitle = true;
        console.log(`   ⚠️ Found match by title (slug differs): "${craftEpisode.title}"`);
        console.log(`      Craft slug: ${craftEpisode.slug}`);
        console.log(`      Cosmic slug: ${cosmicEpisode.slug}`);
      }
    }

    if (!cosmicEpisode) {
      missing.push({
        slug: craftEpisode.slug,
        title: craftEpisode.title,
        broadcastDate: craftEpisode.broadcastDate,
      });
      continue;
    }

    const missingFields: string[] = [];

    // Check photo - only mark as missing if Craft has it and Cosmic doesn't
    if (!cosmicEpisode.thumbnail && !cosmicEpisode.metadata?.image) {
      if (craftEpisode.thumbnail?.[0]?.url) {
        missingFields.push('photo');
      }
    }

    // Check description - only if Craft has it and Cosmic doesn't
    if (!cosmicEpisode.metadata?.description && craftEpisode.description) {
      missingFields.push('description');
    }

    // Check genres - only if Craft has them and Cosmic doesn't OR they differ
    const hasGenres = cosmicEpisode.metadata?.genres?.length > 0;
    const craftHasGenres = craftEpisode.genreTags?.length > 0;
    if (craftHasGenres) {
      if (!hasGenres) {
        missingFields.push('genres');
      }
    }

    // Check hosts - only if Craft has them and Cosmic doesn't OR they differ
    const hasHosts = cosmicEpisode.metadata?.regular_hosts?.length > 0;
    const craftHasHosts = craftEpisode.hosts?.length > 0;
    if (craftHasHosts) {
      if (!hasHosts) {
        missingFields.push('hosts');
      }
    }

    // Check locations - only if Craft has them and Cosmic doesn't OR they differ
    const hasLocations = cosmicEpisode.metadata?.locations?.length > 0;
    const craftHasLocations = craftEpisode.locations?.length > 0;
    if (craftHasLocations) {
      if (!hasLocations) {
        missingFields.push('locations');
      }
    }

    // Check takeovers - only if Craft has them and Cosmic doesn't OR they differ
    const hasTakeovers = cosmicEpisode.metadata?.takeovers?.length > 0;
    const craftHasTakeovers = craftEpisode.takeovers?.length > 0;
    if (craftHasTakeovers) {
      if (!hasTakeovers) {
        missingFields.push('takeovers');
      }
    }

    // Check player - only if Craft has it and Cosmic doesn't
    if (!cosmicEpisode.metadata?.player && craftEpisode.player) {
      missingFields.push('player');
    }

    // Check tracklist - only if Craft has it and Cosmic doesn't
    if (!cosmicEpisode.metadata?.tracklist && craftEpisode.tracklist) {
      missingFields.push('tracklist');
    }

    // Check body_text - only if Craft has it and Cosmic doesn't
    if (!cosmicEpisode.metadata?.body_text && craftEpisode.bodyText) {
      missingFields.push('body_text');
    }

    if (missingFields.length > 0 || matchedByTitle) {
      incomplete.push({
        slug: craftEpisode.slug,
        title: craftEpisode.title,
        missingFields: matchedByTitle && missingFields.length === 0 ? ['slug_mismatch'] : missingFields,
        craftData: craftEpisode,
      });
    }
  }

  return { missing, incomplete };
}

async function createEpisode(
  craftEpisode: any,
  cosmicGenres: any[],
  cosmicLocations: any[],
  cosmicHosts: any[],
  cosmicTakeovers: any[],
  cosmicByTitle: Map<string, any>,
  dryRun: boolean
): Promise<boolean> {
  // Double-check that episode doesn't already exist by title
  if (craftEpisode.title) {
    const normalizedTitle = craftEpisode.title.toLowerCase().trim();
    const existing = cosmicByTitle.get(normalizedTitle);
    if (existing) {
      console.log(`   ⚠️ Episode with same title already exists: ${existing.slug}`);
      console.log(`      Skipping creation to avoid duplicate`);
      return false;
    }
  }
  try {
    console.log(`\n🎯 Creating episode: ${craftEpisode.title} (${craftEpisode.slug})`);

    let mediaItem = null;
    if (
      !dryRun &&
      craftEpisode.thumbnail &&
      Array.isArray(craftEpisode.thumbnail) &&
      craftEpisode.thumbnail.length > 0
    ) {
      const thumbnail = craftEpisode.thumbnail[0];
      if (thumbnail.url && thumbnail.filename) {
        mediaItem = await processImage(thumbnail.url, thumbnail.filename);
      }
    }

    const genres =
      craftEpisode.genreTags
        ?.map((tag: any) => findMatchingCosmicObject(cosmicGenres, tag))
        .filter(Boolean) || [];

    const locations =
      craftEpisode.locations
        ?.map((loc: any) => findMatchingCosmicObject(cosmicLocations, loc))
        .filter(Boolean) || [];

    const hosts =
      craftEpisode.hosts
        ?.map((host: any) => findMatchingCosmicObject(cosmicHosts, host))
        .filter(Boolean) || [];

    const takeovers =
      craftEpisode.takeovers
        ?.map((takeover: any) => findMatchingCosmicObject(cosmicTakeovers, takeover))
        .filter(Boolean) || [];

    const episodeData: any = {
      title: craftEpisode.title,
      slug: craftEpisode.slug,
      type: 'episode',
      metadata: {
        broadcast_date: extractDatePart(craftEpisode.broadcastDate),
        broadcast_time:
          extractTimePart(craftEpisode.broadcastDate) || craftEpisode.broadcastTime || '00:00',
        source: 'migrated_from_craft',
        radiocult_synced: false,
        featured_on_homepage: craftEpisode.featuredOnHomepage || false,
      },
    };

    if (mediaItem) {
      episodeData.thumbnail = mediaItem.name;
      episodeData.metadata.image = mediaItem.name;
    } else if (craftEpisode.thumbnail?.[0]?.url) {
      episodeData.metadata.craft_image_url = craftEpisode.thumbnail[0].url;
    }

    if (genres.length > 0) {
      episodeData.metadata.genres = genres;
    }
    if (locations.length > 0) {
      episodeData.metadata.locations = locations;
    }
    if (hosts.length > 0) {
      episodeData.metadata.regular_hosts = hosts;
    }
    if (takeovers.length > 0) {
      episodeData.metadata.takeovers = takeovers;
    }
    if (craftEpisode.description) {
      episodeData.metadata.description = craftEpisode.description;
    }
    if (craftEpisode.duration) {
      episodeData.metadata.duration = craftEpisode.duration;
    }
    if (craftEpisode.player) {
      episodeData.metadata.player = craftEpisode.player;
    }
    if (craftEpisode.tracklist) {
      episodeData.metadata.tracklist = craftEpisode.tracklist;
    }
    if (craftEpisode.bodyText && craftEpisode.bodyText.trim()) {
      episodeData.metadata.body_text = craftEpisode.bodyText;
    }

    const broadcastDate = extractDatePart(craftEpisode.broadcastDate);
    const broadcastTime = extractTimePart(craftEpisode.broadcastDate) || craftEpisode.broadcastTime || '00:00';
    const isPublished = broadcastDate ? hasBroadcastPassed(broadcastDate, broadcastTime) : false;
    const status = isPublished ? 'published' : 'draft';

    if (dryRun) {
      console.log(`   [DRY RUN] Would create episode as ${status}`);
      console.log(`   📅 Broadcast: ${broadcastDate} ${broadcastTime} (${isPublished ? 'has passed' : 'future'})`);
      console.log(`   📊 Genres: ${genres.length}, Locations: ${locations.length}, Hosts: ${hosts.length}, Takeovers: ${takeovers.length}`);
      return true;
    }

    const result = await cosmic.objects.insertOne({
      ...episodeData,
      status,
    });

    if (result && result.object) {
      console.log(`   ✅ Successfully created episode`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`   ❌ Error creating episode:`, error);
    return false;
  }
}

async function updateEpisode(
  cosmicEpisode: any,
  craftEpisode: any,
  cosmicGenres: any[],
  cosmicLocations: any[],
  cosmicHosts: any[],
  cosmicTakeovers: any[],
  dryRun: boolean
): Promise<boolean> {
  try {
    const slugDiffers = cosmicEpisode.slug !== craftEpisode.slug;
    const titleMatch = cosmicEpisode.title?.toLowerCase().trim() === craftEpisode.title?.toLowerCase().trim();
    
    if (slugDiffers && titleMatch) {
      console.log(`🎯 Updating episode (matched by title, slug differs): ${craftEpisode.title}`);
      console.log(`   Craft slug: ${craftEpisode.slug}`);
      console.log(`   Cosmic slug: ${cosmicEpisode.slug}`);
    } else {
      console.log(`🎯 Updating episode: ${craftEpisode.title} (${craftEpisode.slug})`);
    }

    const updateFields: any = {};

    if (!cosmicEpisode.thumbnail && !cosmicEpisode.metadata?.image) {
      if (
        !dryRun &&
        craftEpisode.thumbnail &&
        Array.isArray(craftEpisode.thumbnail) &&
        craftEpisode.thumbnail.length > 0
      ) {
        const thumbnail = craftEpisode.thumbnail[0];
        if (thumbnail.url && thumbnail.filename) {
          const mediaItem = await processImage(thumbnail.url, thumbnail.filename);
          if (mediaItem) {
            updateFields.thumbnail = mediaItem.name;
            if (!updateFields.metadata) updateFields.metadata = {};
            updateFields.metadata.image = mediaItem.name;
          } else if (thumbnail.url) {
            if (!updateFields.metadata) updateFields.metadata = {};
            updateFields.metadata.craft_image_url = thumbnail.url;
          }
        }
      } else if (craftEpisode.thumbnail?.[0]?.url) {
        if (!updateFields.metadata) updateFields.metadata = {};
        updateFields.metadata.craft_image_url = craftEpisode.thumbnail[0].url;
      }
    }

    if (!updateFields.metadata) updateFields.metadata = {};

    const craftGenres =
      craftEpisode.genreTags
        ?.map((tag: any) => findMatchingCosmicObject(cosmicGenres, tag))
        .filter(Boolean) || [];
    const existingGenres = cosmicEpisode.metadata?.genres || [];
    if (craftGenres.length > 0 && JSON.stringify(craftGenres.sort()) !== JSON.stringify(existingGenres.sort())) {
      updateFields.metadata.genres = craftGenres;
    }

    const craftLocations =
      craftEpisode.locations
        ?.map((loc: any) => findMatchingCosmicObject(cosmicLocations, loc))
        .filter(Boolean) || [];
    const existingLocations = cosmicEpisode.metadata?.locations || [];
    if (craftLocations.length > 0 && JSON.stringify(craftLocations.sort()) !== JSON.stringify(existingLocations.sort())) {
      updateFields.metadata.locations = craftLocations;
    }

    const craftHosts =
      craftEpisode.hosts
        ?.map((host: any) => findMatchingCosmicObject(cosmicHosts, host))
        .filter(Boolean) || [];
    const existingHosts = cosmicEpisode.metadata?.regular_hosts || [];
    if (craftHosts.length > 0 && JSON.stringify(craftHosts.sort()) !== JSON.stringify(existingHosts.sort())) {
      updateFields.metadata.regular_hosts = craftHosts;
    }

    const craftTakeovers =
      craftEpisode.takeovers
        ?.map((takeover: any) => findMatchingCosmicObject(cosmicTakeovers, takeover))
        .filter(Boolean) || [];
    const existingTakeovers = cosmicEpisode.metadata?.takeovers || [];
    if (craftTakeovers.length > 0 && JSON.stringify(craftTakeovers.sort()) !== JSON.stringify(existingTakeovers.sort())) {
      updateFields.metadata.takeovers = craftTakeovers;
    }

    if (!cosmicEpisode.metadata?.description && craftEpisode.description) {
      updateFields.metadata.description = craftEpisode.description;
    }

    if (!cosmicEpisode.metadata?.player && craftEpisode.player) {
      updateFields.metadata.player = craftEpisode.player;
    }

    if (!cosmicEpisode.metadata?.tracklist && craftEpisode.tracklist) {
      updateFields.metadata.tracklist = craftEpisode.tracklist;
    }

    if (!cosmicEpisode.metadata?.body_text && craftEpisode.bodyText && craftEpisode.bodyText.trim()) {
      updateFields.metadata.body_text = craftEpisode.bodyText;
    }

    if (!cosmicEpisode.metadata?.duration && craftEpisode.duration) {
      updateFields.metadata.duration = craftEpisode.duration;
    }

    if (Object.keys(updateFields.metadata).length === 0 && !updateFields.thumbnail) {
      console.log(`   ⏭️ No updates needed`);
      return true;
    }

    if (dryRun) {
      console.log(`   [DRY RUN] Would update with:`, JSON.stringify(updateFields, null, 2));
      return true;
    }

    await cosmic.objects.updateOne(cosmicEpisode.id, updateFields);
    console.log(`   ✅ Successfully updated episode`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating episode:`, error);
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  console.log('🚀 Starting migration gap assessment and fix...\n');
  console.log(`📅 Cutoff date: ${CUTOFF_DATE}\n`);

  const [craftEpisodes, cosmicEpisodes] = await Promise.all([
    fetchEpisodesFromCraft(500),
    fetchEpisodesFromCosmic(),
  ]);

  console.log(`\n📊 Assessment:`);
  console.log(`  Craft episodes: ${craftEpisodes.length}`);
  console.log(`  Cosmic episodes: ${cosmicEpisodes.bySlug.size}\n`);

  const gaps = assessGaps(craftEpisodes, cosmicEpisodes.bySlug, cosmicEpisodes.byTitle);

  console.log(`\n📋 Gap Report:`);
  console.log(`  Missing episodes: ${gaps.missing.length}`);
  console.log(`  Incomplete episodes: ${gaps.incomplete.length}\n`);

  if (gaps.missing.length > 0) {
    console.log(`\n❌ Missing Episodes (${gaps.missing.length}):`);
    gaps.missing.forEach(ep => {
      console.log(`  - ${ep.title} (${ep.slug})`);
    });
  }

  if (gaps.incomplete.length > 0) {
    console.log(`\n⚠️ Incomplete Episodes (${gaps.incomplete.length}):`);
    gaps.incomplete.forEach(ep => {
      console.log(`  - ${ep.title} (${ep.slug}): Missing ${ep.missingFields.join(', ')}`);
    });
  }

  if (dryRun && (gaps.missing.length > 0 || gaps.incomplete.length > 0)) {
    console.log(`\n🔍 Dry run complete. Run without --dry-run to apply fixes.`);
    return;
  }

  if (gaps.missing.length === 0 && gaps.incomplete.length === 0) {
    console.log(`\n✅ No gaps found! Everything is up to date.`);
    return;
  }

  console.log(`\n🔧 Fixing gaps...\n`);

  const cosmicGenres = await getCosmicGenres();
  const cosmicLocations = await getCosmicLocations();
  const cosmicHosts = await getCosmicRegularHosts();
  const cosmicTakeovers = await getCosmicTakeovers();

  console.log(
    `✅ Loaded references: ${cosmicGenres.length} genres, ${cosmicLocations.length} locations, ${cosmicHosts.length} hosts, ${cosmicTakeovers.length} takeovers\n`
  );

  let created = 0;
  let updated = 0;
  let failed = 0;

  const craftEpisodesMap = new Map(craftEpisodes.map(ep => [ep.slug, ep]));

  for (const missing of gaps.missing) {
    const craftEpisode = craftEpisodesMap.get(missing.slug);
    if (!craftEpisode) continue;

    const success = await createEpisode(
      craftEpisode,
      cosmicGenres,
      cosmicLocations,
      cosmicHosts,
      cosmicTakeovers,
      cosmicEpisodes.byTitle,
      dryRun
    );

    if (success) {
      created++;
    } else {
      failed++;
    }
  }

  for (const incomplete of gaps.incomplete) {
    // Find the episode - try by slug first, then by title
    let cosmicEpisode = cosmicEpisodes.bySlug.get(incomplete.slug);
    if (!cosmicEpisode && incomplete.craftData.title) {
      const normalizedTitle = incomplete.craftData.title.toLowerCase().trim();
      cosmicEpisode = cosmicEpisodes.byTitle.get(normalizedTitle);
    }
    if (!cosmicEpisode) {
      console.log(`   ⚠️ Could not find Cosmic episode for: ${incomplete.title}`);
      failed++;
      continue;
    }

    const success = await updateEpisode(
      cosmicEpisode,
      incomplete.craftData,
      cosmicGenres,
      cosmicLocations,
      cosmicHosts,
      cosmicTakeovers,
      dryRun
    );

    if (success) {
      updated++;
    } else {
      failed++;
    }
  }

  console.log(`\n🎉 Fix complete!`);
  console.log(`  ✅ Created: ${created}`);
  console.log(`  🔄 Updated: ${updated}`);
  console.log(`  ❌ Failed: ${failed}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

