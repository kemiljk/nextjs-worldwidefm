import { createBucketClient } from '@cosmicjs/sdk';
import { cosmic } from './cosmic-config';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://worldwidefm.net';
const BATCH_SIZE = 100;

const EPISODE_PROPS =
  'id,slug,title,type,status,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.description,metadata.genres,metadata.regular_hosts,metadata.takeovers';

interface CosmicObject {
  id: string;
  slug: string;
  title: string;
  type: string;
  status?: string;
  metadata?: {
    description?: string | null;
    image?: { url?: string; imgix_url?: string } | null;
    external_image_url?: string | null;
    broadcast_date?: string | null;
    genres?: CosmicObject[];
    regular_hosts?: CosmicObject[];
    takeovers?: CosmicObject[];
  };
}

export interface ExportRow {
  showTitle: string;
  showImage: string;
  showDescription: string;
  hostName: string;
  series: string;
  musicGenres: string;
  slug: string;
  broadcastDate: string;
  episodeUrl: string;
}

export interface ExportShowsOptions {
  hostOrSeriesSlug: string;
  includeDrafts?: boolean;
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

export function rowsToCsv(rows: ExportRow[]): string {
  const headers = [
    'Show Title',
    'Show Image',
    'Show Description',
    'Host Name',
    'Series',
    'Music Genres',
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

  const genres = episode.metadata?.genres?.map(genre => genre.title).filter(Boolean) || [];

  return {
    showTitle: episode.title || '',
    showImage: getEpisodeImageUrl(episode),
    showDescription: stripHtmlTags(episode.metadata?.description || ''),
    hostName: hosts.join(', '),
    series: series.join(', '),
    musicGenres: genres.join(', '),
    slug: episode.slug || '',
    broadcastDate: episode.metadata?.broadcast_date || '',
    episodeUrl: episode.slug ? `${SITE_URL}/episode/${episode.slug}` : '',
  };
}

async function findObjectBySlug(type: string, slug: string): Promise<CosmicObject | null> {
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

async function resolveHostOrSeriesBySlug(slug: string): Promise<CosmicObject | null> {
  const fromSeries = await findObjectBySlug('series', slug);
  if (fromSeries) return fromSeries;

  return findObjectBySlug('regular-hosts', slug);
}

async function fetchAllEpisodes(
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

    if (batch.length < BATCH_SIZE || episodes.length >= total) {
      break;
    }

    skip += BATCH_SIZE;
  }

  return episodes;
}

export function buildExportFilename(slug: string): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${slug}-${timestamp}.csv`;
}

export async function exportShows(options: ExportShowsOptions): Promise<{
  csv: string;
  count: number;
  filename: string;
}> {
  const target = await resolveHostOrSeriesBySlug(options.hostOrSeriesSlug);

  if (!target) {
    throw new Error(`Host or series not found for slug "${options.hostOrSeriesSlug}"`);
  }

  const query: Record<string, unknown> = {
    type: 'episode',
    'metadata.regular_hosts': { $in: [target.id] },
  };

  if (!options.includeDrafts) {
    query.status = 'published';
  }

  const episodes = await fetchAllEpisodes(query, options.includeDrafts ?? false);
  const rows = episodes.map(mapEpisodeToRow);

  return {
    csv: rowsToCsv(rows),
    count: rows.length,
    filename: buildExportFilename(target.slug),
  };
}

export function getCosmicClientForScript() {
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
