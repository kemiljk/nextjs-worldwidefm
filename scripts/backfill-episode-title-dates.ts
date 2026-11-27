import { createBucketClient } from '@cosmicjs/sdk';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { appendTitleDate, stripTitleDate } from '../lib/episode-title';

config({ path: '.env.local', quiet: true });

// Adds the broadcast date to the end of every episode title in Cosmic, e.g.
// "Luke Una" -> "Luke Una – 06.10.2026", using each episode's own broadcast_date. It makes
// same-named shows easy to tell apart in the Cosmic dashboard. The website strips the date
// from titles everywhere (lib/episode-title.ts), so listeners never see it.
//
// Only `title` is written. Slugs, URLs and every other field are left alone. Episodes with no
// valid broadcast date, or whose title already ends in that date, are skipped. Drafts are included.
//
//   bun run scripts/backfill-episode-title-dates.ts                  # dry run, writes a report
//   bun run scripts/backfill-episode-title-dates.ts --limit=20       # dry run on a sample
//   bun run scripts/backfill-episode-title-dates.ts --apply          # update Cosmic
//   bun run scripts/backfill-episode-title-dates.ts --revert=<file>  # restore titles from a report
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter(arg => arg.startsWith('--'))
    .map(arg => {
      const [key, value = 'true'] = arg.slice(2).split('=');
      return [key, value];
    })
);
const apply = args.apply === 'true';
const limit = Number(args.limit) || Infinity;

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

type Episode = {
  id: string;
  slug: string;
  title: string;
  status: string;
  metadata?: { broadcast_date?: string | null };
};
type Change = { id: string; slug: string; status: string; before: string; after: string };

// The archive is ~12,000 episodes, so read it in big pages.
const PAGE = 1000;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function updateTitle(id: string, title: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await cosmic.objects.updateOne(id, { title });
      return;
    } catch (error) {
      const status = (error as { status?: number }).status ?? 0;
      if (attempt >= 3 || !(status === 429 || status >= 500)) throw error;
      await pause(1000 * (attempt + 1));
    }
  }
}

async function collect(): Promise<{
  changes: Change[];
  scanned: number;
  noDate: number;
  already: number;
  otherDate: number;
}> {
  const changes: Change[] = [];
  let scanned = 0;
  let noDate = 0;
  let already = 0;
  let otherDate = 0;

  for (let skip = 0; changes.length < limit; skip += PAGE) {
    let response;
    try {
      response = await cosmic.objects
        .find({ type: 'episode' })
        .props('id,slug,title,status,metadata.broadcast_date')
        .status('any')
        .sort('created_at')
        .limit(PAGE)
        .skip(skip)
        .depth(0);
    } catch (error) {
      if ((error as { status?: number }).status === 404) break;
      throw error;
    }

    for (const episode of response.objects as Episode[]) {
      scanned += 1;
      const date = episode.metadata?.broadcast_date;
      const after = appendTitleDate(episode.title, date);
      // A title that already ends in some other date keeps it: adding a second would read badly.
      if (after !== episode.title && stripTitleDate(episode.title) !== episode.title) {
        otherDate += 1;
        continue;
      }
      if (after === episode.title) {
        // Either already dated, or there was nothing valid to add.
        if (/^\d{4}-\d{2}-\d{2}/.test(date ?? '')) already += 1;
        else noDate += 1;
        continue;
      }
      changes.push({
        id: episode.id,
        slug: episode.slug,
        status: episode.status,
        before: episode.title,
        after,
      });
      if (changes.length >= limit) break;
    }
    if (skip + PAGE >= response.total) break;
  }
  return { changes, scanned, noDate, already, otherDate };
}

async function writeReport(kind: string, changes: Change[]) {
  await mkdir('tasks/cosmic-migrations', { recursive: true });
  const file = `tasks/cosmic-migrations/episode-title-dates-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await writeFile(file, JSON.stringify(changes, null, 2) + '\n');
  return file;
}

async function revert(file: string) {
  const { readFile } = await import('node:fs/promises');
  const changes = JSON.parse(await readFile(file, 'utf8')) as Change[];
  console.log(`${apply ? 'Restoring' : 'Would restore'} ${changes.length} titles from ${file}`);
  if (!apply) return console.log('Dry run only. Add --apply to restore.');
  for (const [index, change] of changes.entries()) {
    await updateTitle(change.id, change.before);
    if ((index + 1) % 25 === 0) console.log(`  ${index + 1}/${changes.length}`);
    await pause(150);
  }
  console.log('Done.');
}

async function main() {
  if (typeof args.revert === 'string') return revert(args.revert);

  const { changes, scanned, noDate, already, otherDate } = await collect();
  console.log(
    `Scanned ${scanned} episodes: ${changes.length} to update, ${already} already dated, ${otherDate} ending in a different date, ${noDate} without a valid broadcast date.`
  );
  for (const change of changes.slice(0, 12)) {
    console.log(`  ${change.status.padEnd(9)} ${change.before}  ->  ${change.after}`);
  }
  if (changes.length > 12) console.log(`  ...and ${changes.length - 12} more`);

  if (!apply) {
    const file = await writeReport('dry-run', changes);
    console.log(
      `Dry run only. Full before/after list: ${file}\nRe-run with --apply to update Cosmic.`
    );
    return;
  }

  // Written first, so every original title can be restored with --revert=<file>.
  const file = await writeReport('applied', changes);
  console.log(`Backup of original titles: ${file}`);
  let failed = 0;
  for (const [index, change] of changes.entries()) {
    try {
      await updateTitle(change.id, change.after);
    } catch (error) {
      failed += 1;
      console.error(`Failed ${change.id} (${change.before}):`, (error as Error).message);
    }
    if ((index + 1) % 25 === 0) console.log(`  ${index + 1}/${changes.length}`);
    await pause(150);
  }
  console.log(`Updated ${changes.length - failed} titles${failed ? `, ${failed} failed` : ''}.`);
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
