import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';
import { writeFile } from 'node:fs/promises';
import { normalizeMixcloudUsername } from '../lib/mixcloud-username';

dotenv.config({ path: '.env.local', quiet: true });

// Read-only. Lists the hosts on recent shows and whether Mixcloud can tag them.
// Mixcloud only tags a host whose Cosmic profile has a valid "Mixcloud Username",
// so every host listed as MISSING or INVALID is left untagged by the upload form.
//
//   bun run scripts/audit-mixcloud-hosts.ts                    # last 120 days
//   bun run scripts/audit-mixcloud-hosts.ts --days=365 --csv=hosts.csv
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter(arg => arg.startsWith('--'))
    .map(arg => {
      const [key, value = 'true'] = arg.slice(2).split('=');
      return [key, value];
    })
);
const days = Number(args.days) || 120;

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
});

type Host = { id: string; title: string; slug: string; metadata?: { mixcloud_username?: string } };
type Episode = { metadata?: { regular_hosts?: Host[] } };

async function main() {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const counts = new Map<string, { host: Host; shows: number }>();

  for (let skip = 0; ; skip += 100) {
    let response;
    try {
      response = await cosmic.objects
        .find({ type: 'episode', 'metadata.broadcast_date': { $gte: since } })
        .props('id,metadata.regular_hosts')
        .depth(1)
        .limit(100)
        .skip(skip);
    } catch (error) {
      if ((error as { status?: number }).status === 404) break;
      throw error;
    }
    for (const episode of response.objects as Episode[]) {
      for (const host of episode.metadata?.regular_hosts ?? []) {
        if (!host?.id) continue;
        const entry = counts.get(host.id) ?? { host, shows: 0 };
        entry.shows += 1;
        counts.set(host.id, entry);
      }
    }
    if (skip + 100 >= response.total) break;
  }

  const rows = [...counts.values()]
    .map(({ host, shows }) => {
      const raw = host.metadata?.mixcloud_username?.trim() ?? '';
      const username = normalizeMixcloudUsername(raw);
      return {
        status: !raw ? 'MISSING' : username ? 'OK' : 'INVALID',
        name: host.title,
        shows,
        value: raw,
        slug: host.slug,
      };
    })
    .sort((a, b) => b.shows - a.shows);

  const by = (status: string) => rows.filter(row => row.status === status);
  console.log(
    `Hosts on shows since ${since}: ${rows.length}. OK ${by('OK').length}, missing ${by('MISSING').length}, invalid ${by('INVALID').length}.`
  );
  for (const row of rows.filter(row => row.status !== 'OK').slice(0, 40)) {
    console.log(
      `${row.status.padEnd(8)} ${String(row.shows).padStart(3)} shows  ${row.name}  ${row.value}`
    );
  }

  if (typeof args.csv === 'string') {
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const lines = [
      ['Status', 'Host', 'Shows in period', 'Mixcloud username in Cosmic', 'Cosmic slug'],
      ...rows.map(row => [row.status, row.name, row.shows, row.value, row.slug]),
    ].map(line => line.map(cell).join(','));
    await writeFile(args.csv, lines.join('\n') + '\n');
    console.log(`Wrote ${args.csv}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
