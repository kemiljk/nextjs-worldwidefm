import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const SITE_URL = 'https://worldwidefm.net';
const BATCH_SIZE = 100;

const EPISODE_PROPS =
  'id,slug,title,type,status,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.description,metadata.tracklist,metadata.genres,metadata.regular_hosts,metadata.takeovers';

interface CosmicObject {
  id: string;
  slug: string;
  title: string;
  type: string;
  status?: string;
  metadata?: {
    description?: string | null;
    tracklist?: string | null;
    image?: { url?: string; imgix_url?: string } | null;
    external_image_url?: string | null;
    broadcast_date?: string | null;
    genres?: CosmicObject[];
    regular_hosts?: CosmicObject[];
    takeovers?: CosmicObject[];
  };
}

interface ExportRow {
  showTitle: string;
  showImage: string;
  showDescription: string;
  hostName: string;
  series: string;
  musicGenres: string;
  tracklist: string;
  slug: string;
  broadcastDate: string;
  episodeUrl: string;
}

interface CliOptions {
  series?: string;
  seriesSlug?: string;
  hostSlug?: string;
  takeoverSlug?: string;
  output?: string;
  includeDrafts: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { includeDrafts: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--series':
        options.series = next;
        i++;
        break;
      case '--series-slug':
        options.seriesSlug = next;
        i++;
        break;
      case '--host-slug':
        options.hostSlug = next;
        i++;
        break;
      case '--takeover-slug':
        options.takeoverSlug = next;
        i++;
        break;
      case '--output':
        options.output = next;
        i++;
        break;
      case '--include-drafts':
        options.includeDrafts = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEpisodeImageUrl(episode: CosmicObject): string {
  const metadata = episode.metadata;
  if (!metadata) return '';

  if (metadata.external_image_url) {
    return metadata.external_image_url;
  }

  return metadata.image?.imgix_url || metadata.image?.url || '';
}

function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: ExportRow[]): string {
  const headers = [
    'Show Title',
    'Show Image',
    'Show Description',
    'Host Name',
    'Series',
    'Music Genres',
    'Tracklist',
    'Slug',
    'Broadcast Date',
    'Episode URL',
  ];

  const lines = [
    headers.join(','),
    ...rows.map(row =>
      [
        row.showTitle,
        row.showImage,
        row.showDescription,
        row.hostName,
        row.series,
        row.musicGenres,
        row.tracklist,
        row.slug,
        row.broadcastDate,
        row.episodeUrl,
      ]
        .map(value => escapeCsvCell(value))
        .join(',')
    ),
  ];

  return `${lines.join('\n')}\n`;
}

function mapEpisodeToRow(episode: CosmicObject): ExportRow {
  const hosts =
    episode.metadata?.regular_hosts
      ?.filter(item => item.type === 'regular-hosts')
      .map(item => item.title)
      .filter(Boolean) || [];

  const series =
    episode.metadata?.regular_hosts
      ?.filter(item => item.type === 'series')
      .map(item => item.title)
      .filter(Boolean) || [];

  const genres =
    episode.metadata?.genres?.map(genre => genre.title).filter(Boolean) || [];

  return {
    showTitle: episode.title || '',
    showImage: getEpisodeImageUrl(episode),
    showDescription: stripHtmlTags(episode.metadata?.description || ''),
    hostName: hosts.join(', '),
    series: series.join(', '),
    musicGenres: genres.join(', '),
    tracklist: stripHtmlTags(episode.metadata?.tracklist || ''),
    slug: episode.slug || '',
    broadcastDate: episode.metadata?.broadcast_date || '',
    episodeUrl: episode.slug ? `${SITE_URL}/episode/${episode.slug}` : '',
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCosmicClient() {
  const bucketSlug = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
  const readKey = process.env.NEXT_PUBLIC_COSMIC_READ_KEY;

  if (!bucketSlug || !readKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_COSMIC_BUCKET_SLUG or NEXT_PUBLIC_COSMIC_READ_KEY in .env.local'
    );
  }

  return createBucketClient({
    bucketSlug,
    readKey,
    writeKey: process.env.COSMIC_WRITE_KEY,
  });
}

async function findObjectBySlug(
  cosmic: ReturnType<typeof createBucketClient>,
  type: string,
  slug: string
): Promise<CosmicObject | null> {
  try {
    const response = await cosmic.objects
      .findOne({ type, slug })
      .props('id,slug,title,type')
      .depth(0);

    return (response.object as CosmicObject) || null;
  } catch {
    return null;
  }
}

async function findObjectByTitle(
  cosmic: ReturnType<typeof createBucketClient>,
  type: string,
  title: string
): Promise<CosmicObject | null> {
  try {
    const response = await cosmic.objects
      .find({ type, title })
      .props('id,slug,title,type')
      .limit(1)
      .depth(0);

    return (response.objects?.[0] as CosmicObject) || null;
  } catch {
    // Fall through to case-insensitive search.
  }

  try {
    const response = await cosmic.objects
      .find({
        type,
        title: { $regex: title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      })
      .props('id,slug,title,type')
      .limit(1)
      .depth(0);

    return (response.objects?.[0] as CosmicObject) || null;
  } catch {
    return null;
  }
}

async function resolveHostOrSeriesTarget(
  cosmic: ReturnType<typeof createBucketClient>,
  options: Pick<CliOptions, 'series' | 'seriesSlug'>
): Promise<CosmicObject | null> {
  if (options.seriesSlug) {
    const fromSeries = await findObjectBySlug(cosmic, 'series', options.seriesSlug);
    if (fromSeries) return fromSeries;

    return findObjectBySlug(cosmic, 'regular-hosts', options.seriesSlug);
  }

  if (options.series) {
    const fromSeries = await findObjectByTitle(cosmic, 'series', options.series);
    if (fromSeries) return fromSeries;

    return findObjectByTitle(cosmic, 'regular-hosts', options.series);
  }

  return null;
}

async function buildEpisodeQuery(
  cosmic: ReturnType<typeof createBucketClient>,
  options: CliOptions
): Promise<Record<string, unknown>> {
  const query: Record<string, unknown> = {
    type: 'episode',
  };

  if (!options.includeDrafts) {
    query.status = 'published';
  }

  if (options.series || options.seriesSlug) {
    const target = await resolveHostOrSeriesTarget(cosmic, options);

    if (!target) {
      throw new Error(
        `Host or series not found for ${options.seriesSlug ? `slug "${options.seriesSlug}"` : `title "${options.series}"`}`
      );
    }

    console.log(`Found host/series: ${target.title} (${target.id}, type: ${target.type})`);
    query['metadata.regular_hosts'] = { $in: [target.id] };
    return query;
  }

  if (options.hostSlug) {
    const host = await findObjectBySlug(cosmic, 'regular-hosts', options.hostSlug);
    if (!host) {
      throw new Error(`Host not found for slug "${options.hostSlug}"`);
    }

    console.log(`Found host: ${host.title} (${host.id})`);
    query['metadata.regular_hosts'] = { $in: [host.id] };
    return query;
  }

  if (options.takeoverSlug) {
    const takeover = await findObjectBySlug(cosmic, 'takeovers', options.takeoverSlug);
    if (!takeover) {
      throw new Error(`Takeover not found for slug "${options.takeoverSlug}"`);
    }

    console.log(`Found takeover: ${takeover.title} (${takeover.id})`);
    query['metadata.takeovers.id'] = { $in: [takeover.id] };
    return query;
  }

  throw new Error(
    'Provide a filter: --series, --series-slug, --host-slug, or --takeover-slug'
  );
}

async function fetchAllEpisodes(
  cosmic: ReturnType<typeof createBucketClient>,
  query: Record<string, unknown>,
  includeDrafts: boolean
): Promise<CosmicObject[]> {
  const episodes: CosmicObject[] = [];
  let skip = 0;
  let total = 0;

  while (true) {
    let request = cosmic.objects
      .find(query)
      .props(EPISODE_PROPS)
      .limit(BATCH_SIZE)
      .skip(skip)
      .sort('metadata.broadcast_date')
      .depth(1);

    if (includeDrafts) {
      request = request.status('any');
    }

    const response = await request;
    const batch = (response.objects || []) as CosmicObject[];
    total = response.total || batch.length;

    episodes.push(...batch);
    console.log(`Fetched ${episodes.length}/${total} episodes...`);

    if (batch.length < BATCH_SIZE || episodes.length >= total) {
      break;
    }

    skip += BATCH_SIZE;
  }

  return episodes;
}

function resolveOutputPath(options: CliOptions): string {
  if (options.output) {
    return path.resolve(options.output);
  }

  const label =
    options.seriesSlug ||
    (options.series ? slugify(options.series) : null) ||
    options.hostSlug ||
    options.takeoverSlug ||
    'shows';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve('exports', `${label}-${timestamp}.csv`);
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const cosmic = getCosmicClient();
  const query = await buildEpisodeQuery(cosmic, options);
  const episodes = await fetchAllEpisodes(cosmic, query, options.includeDrafts);

  if (episodes.length === 0) {
    console.warn('No episodes found for the provided filter.');
  }

  const rows = episodes.map(mapEpisodeToRow);
  const csv = toCsv(rows);
  const outputPath = resolveOutputPath(options);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, csv, 'utf8');

  console.log(`\nExported ${rows.length} shows to ${outputPath}`);
}

run().catch(error => {
  console.error('Export failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
