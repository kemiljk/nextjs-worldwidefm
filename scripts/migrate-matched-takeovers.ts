import { createBucketClient } from '@cosmicjs/sdk';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';

config({ path: '.env.local', quiet: true });
const apply = process.argv.includes('--apply');
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: (process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY) || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

// Exact title and slug matches, reviewed against the existing profiles.
const matches = [
  {
    name: 'Future Bubblers',
    takeover: '697b38676c8aeb5d6cf4de44',
    host: '688125f83305100b7c998726',
  },
  { name: 'Shai Space', takeover: '695bb34d6d538c4d2c719544', host: '69f9af4ea963c4f5f0d95e7c' },
];

type Episode = {
  id: string;
  title: string;
  status: string;
  metadata: { regular_hosts?: string[] | null; takeovers?: string[] | null };
};
const ids = (values: unknown): string[] =>
  Array.isArray(values)
    ? values.map(value => (typeof value === 'string' ? value : value?.id)).filter(Boolean)
    : [];
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const changes: { episode: Episode; host: string; hostsBefore: string[] }[] = [];
  for (const match of matches) {
    for (let skip = 0; ; skip += 100) {
      let result;
      try {
        result = await cosmic.objects
          .find({ type: 'episode', 'metadata.takeovers': { $in: [match.takeover] } })
          .props('id,title,status,metadata.regular_hosts,metadata.takeovers')
          .depth(0)
          .status('any')
          .limit(100)
          .skip(skip);
      } catch (error) {
        if ((error as { status?: number }).status === 404) break;
        throw error;
      }
      const episodes = result.objects as Episode[];
      for (const episode of episodes) {
        const hostsBefore = ids(episode.metadata?.regular_hosts);
        if (!hostsBefore.includes(match.host))
          changes.push({ episode, host: match.host, hostsBefore });
      }
      if (skip + episodes.length >= result.total || !episodes.length) break;
    }
  }
  console.log(
    `${apply ? 'Applying' : 'Dry run:'} ${changes.length} episode relationship additions`
  );
  for (const change of changes) console.log(`  ${change.episode.title}`);
  if (!apply || !changes.length) return;
  await mkdir('tasks/cosmic-migrations', { recursive: true });
  const backup = `tasks/cosmic-migrations/matched-takeovers-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await writeFile(backup, JSON.stringify(changes, null, 2) + '\n', { flag: 'wx' });
  console.log(`Snapshot saved: ${backup}`);
  for (const change of changes) {
    const current = await cosmic.objects
      .findOne({ id: change.episode.id })
      .props('id,status,metadata.regular_hosts,metadata.takeovers')
      .depth(0)
      .status('any');
    if (
      current.object.status !== change.episode.status ||
      JSON.stringify(ids(current.object.metadata?.regular_hosts)) !==
        JSON.stringify(change.hostsBefore) ||
      JSON.stringify(ids(current.object.metadata?.takeovers)) !==
        JSON.stringify(ids(change.episode.metadata?.takeovers))
    ) {
      throw new Error(`Episode changed since snapshot: ${change.episode.title}`);
    }
    await cosmic.objects.updateOne(change.episode.id, {
      metadata: { regular_hosts: [...change.hostsBefore, change.host] },
    });
    let verified = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const check = await cosmic.objects
        .findOne({ id: change.episode.id })
        .props('id,status,metadata.regular_hosts,metadata.takeovers')
        .depth(0)
        .status('any');
      if (
        check.object.status === change.episode.status &&
        JSON.stringify(ids(check.object.metadata?.regular_hosts)) ===
          JSON.stringify([...change.hostsBefore, change.host]) &&
        JSON.stringify(ids(check.object.metadata?.takeovers)) ===
          JSON.stringify(ids(change.episode.metadata?.takeovers))
      ) {
        verified = true;
        break;
      }
      await pause(1000);
    }
    if (!verified) throw new Error(`Could not verify ${change.episode.title}`);
    console.log(`Verified: ${change.episode.title}`);
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
