import { createBucketClient } from '@cosmicjs/sdk';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';

config({ path: '.env.local', quiet: true });

const FRIDAY = '687b9263d5e8b76ec441b957';
const SERIES = '68794a43d5e8b76ec441b65f';
const apply = process.argv.includes('--apply');
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: (process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY) || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

type Item = { id: string; title: string; slug: string; type: string; status: string; metadata: { type: string } };

async function collect(type: string): Promise<Item[]> {
  const items: Item[] = [];
  for (let skip = 0; ; skip += 100) {
    let result;
    try {
      result = await cosmic.objects
        .find({ type, 'metadata.type': FRIDAY })
        .props(['id', 'title', 'slug', 'type', 'status', 'metadata.type'])
        .status('any')
        .limit(100)
        .skip(skip)
        .depth(0);
    } catch (error) {
      if ((error as { status?: number }).status === 404) return items;
      throw error;
    }
    items.push(...(result.objects as Item[]));
    if (items.length >= result.total || result.objects.length === 0) return items;
  }
}

async function main() {
  const types = await cosmic.objects.find({ type: 'types', id: { $in: [FRIDAY, SERIES] } }).props(['id', 'slug']).limit(10);
  if (!types.objects.some((x: { id: string; slug: string }) => x.id === FRIDAY && x.slug === 'friday-curates') ||
      !types.objects.some((x: { id: string; slug: string }) => x.id === SERIES && x.slug === 'series')) {
    throw new Error('Expected Friday Curates and Series classifications were not found');
  }
  const items = [...(await collect('episode')), ...(await collect('regular-hosts'))];
  if (items.some(item => item.metadata?.type !== FRIDAY)) throw new Error('Unexpected classification in results');
  console.log(`${apply ? 'Migrating' : 'Dry run:'} ${items.length} objects (${items.filter(x => x.type === 'episode').length} episodes, ${items.filter(x => x.type === 'regular-hosts').length} hosts)`);
  if (!apply || items.length === 0) return;

  const backupDir = 'tasks/cosmic-migrations';
  await mkdir(backupDir, { recursive: true });
  const backup = `${backupDir}/friday-curates-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await writeFile(backup, JSON.stringify({ from: FRIDAY, to: SERIES, items }, null, 2) + '\n', { flag: 'wx' });
  console.log(`Snapshot saved: ${backup}`);
  let updated = 0;
  for (const item of items) {
    const current = await cosmic.objects.findOne({ id: item.id }).props(['id', 'metadata.type']).status('any').depth(0);
    if (current.object.metadata?.type !== FRIDAY) throw new Error(`Classification changed for ${item.id}; stopping`);
    await cosmic.objects.updateOne(item.id, { metadata: { type: SERIES } });
    let verified = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 1000));
      const check = await cosmic.objects.findOne({ id: item.id }).props(['id', 'status', 'metadata.type']).status('any').depth(0);
      if (check.object.metadata?.type === SERIES && check.object.status === item.status) {
        verified = true;
        break;
      }
    }
    if (!verified) {
      throw new Error(`Could not verify classification and publication status for ${item.id}; stopping`);
    }
    updated++;
    console.log(`Verified ${updated}/${items.length}: ${item.title}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
