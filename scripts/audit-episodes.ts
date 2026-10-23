/**
 * Read-only audit of episode data in Cosmic: which published episodes are
 * missing a tracklist, host, location, genres, show category, image or archive.
 *
 *   bun run scripts/audit-episodes.ts                 # summary
 *   bun run scripts/audit-episodes.ts --csv out.csv   # plus one row per episode with gaps
 *   bun run scripts/audit-episodes.ts --since 2025-01-01
 *
 * Nothing is written to Cosmic.
 */
import { writeFileSync } from 'node:fs';
import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
});

const BATCH_SIZE = 500;
// Archives go up after the broadcast, so only flag a missing player once a week has passed.
const ARCHIVE_GRACE_DAYS = 7;

type Check = 'tracklist' | 'hosts' | 'locations' | 'genres' | 'category' | 'image' | 'archive';
const CHECKS: Check[] = [
  'tracklist',
  'hosts',
  'locations',
  'genres',
  'category',
  'image',
  'archive',
];

type Episode = {
  id: string;
  slug: string;
  title: string;
  metadata?: Record<string, unknown> | null;
};

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const filled = (value: unknown) =>
  Array.isArray(value)
    ? value.length > 0
    : typeof value === 'string'
      ? value.trim() !== ''
      : !!value;

function findGaps(episode: Episode, archiveCutoff: string): Check[] {
  const m = episode.metadata || {};
  const image = m.image as { url?: string } | null | undefined;
  const gaps: Check[] = [];

  if (!filled(m.tracklist)) gaps.push('tracklist');
  if (!filled(m.regular_hosts)) gaps.push('hosts');
  if (!filled(m.locations)) gaps.push('locations');
  if (!filled(m.genres)) gaps.push('genres');
  if (!filled(m.type)) gaps.push('category');
  // Episodes without their own image show the host's, so only flag when neither exists.
  if (!filled(m.external_image_url) && !image?.url && !filled(m.regular_hosts)) gaps.push('image');
  if (!filled(m.player) && String(m.broadcast_date || '') <= archiveCutoff) gaps.push('archive');

  return gaps;
}

async function fetchEpisodes(since?: string): Promise<Episode[]> {
  const query: Record<string, unknown> = { type: 'episode' };
  if (since) query['metadata.broadcast_date'] = { $gte: since };

  const episodes: Episode[] = [];
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const response = await cosmic.objects
      .find(query)
      .props(
        'id,slug,title,metadata.broadcast_date,metadata.tracklist,metadata.regular_hosts,metadata.locations,metadata.genres,metadata.type,metadata.image,metadata.external_image_url,metadata.player'
      )
      .depth(0)
      .limit(BATCH_SIZE)
      .skip(skip)
      .sort('-metadata.broadcast_date')
      .status('published');

    const batch = (response.objects || []) as Episode[];
    episodes.push(...batch);
    process.stdout.write(`\rFetched ${episodes.length}/${response.total ?? '?'} episodes`);
    if (batch.length < BATCH_SIZE) break;
  }
  process.stdout.write('\n');
  return episodes;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || !process.env.NEXT_PUBLIC_COSMIC_READ_KEY) {
    throw new Error('NEXT_PUBLIC_COSMIC_BUCKET_SLUG and NEXT_PUBLIC_COSMIC_READ_KEY are required');
  }

  const since = argValue('--since');
  const csvPath = argValue('--csv');
  const archiveCutoff = new Date(Date.now() - ARCHIVE_GRACE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const episodes = await fetchEpisodes(since);
  const rows = episodes.map(episode => ({ episode, gaps: findGaps(episode, archiveCutoff) }));

  console.log(`\n${episodes.length} published episodes${since ? ` since ${since}` : ''}`);
  for (const check of CHECKS) {
    const count = rows.filter(row => row.gaps.includes(check)).length;
    const percent = episodes.length ? ((count / episodes.length) * 100).toFixed(1) : '0';
    console.log(`  missing ${check.padEnd(10)} ${String(count).padStart(6)}  (${percent}%)`);
  }
  console.log(
    `  complete           ${String(rows.filter(row => !row.gaps.length).length).padStart(6)}`
  );

  if (csvPath) {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      ['broadcast_date', 'title', 'slug', ...CHECKS.map(check => `missing_${check}`)].join(','),
      ...rows
        .filter(row => row.gaps.length)
        .map(({ episode, gaps }) =>
          [
            String(episode.metadata?.broadcast_date || ''),
            escape(episode.title),
            episode.slug,
            ...CHECKS.map(check => (gaps.includes(check) ? 'yes' : '')),
          ].join(',')
        ),
    ];
    writeFileSync(csvPath, `${lines.join('\n')}\n`);
    console.log(`\nWrote ${lines.length - 1} rows to ${csvPath}`);
  }
}

main().catch(error => {
  console.error('Audit failed:', error);
  process.exit(1);
});
