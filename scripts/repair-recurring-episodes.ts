import dotenv from 'dotenv';
import { createBucketClient } from '@cosmicjs/sdk';
import { getRecurringEpisodeContent, RECURRING_SHOWS } from '@/lib/recurring-shows';

dotenv.config({ path: '.env.local' });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

const applyChanges = process.argv.includes('--apply');
const today = new Date().toISOString().slice(0, 10);

function requireEnvironment(name: string, value: string) {
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
}

async function findHost(slug: string) {
  const response = await cosmic.objects
    .findOne({ type: 'regular-hosts', slug })
    .props('id,metadata.description,metadata.image,metadata.external_image_url')
    .status('any');

  return response.object || null;
}

async function main() {
  requireEnvironment('NEXT_PUBLIC_COSMIC_BUCKET_SLUG', process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '');
  requireEnvironment('NEXT_PUBLIC_COSMIC_READ_KEY', process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '');

  if (applyChanges) {
    requireEnvironment('COSMIC_WRITE_KEY', process.env.COSMIC_WRITE_KEY || '');
  }

  const templates = new Map(RECURRING_SHOWS.map(template => [template.title, template]));
  const response = await cosmic.objects
    .find({
      type: 'episode',
      status: 'draft',
      'metadata.source': 'recurring-auto',
      'metadata.broadcast_date': { $gte: today },
    })
    .props('id,title,metadata.broadcast_date,metadata.description,metadata.external_image_url')
    .limit(1000);

  const episodes = response.objects || [];
  console.log(`${applyChanges ? 'Applying' : 'Dry run:'} ${episodes.length} upcoming recurring draft(s)`);

  for (const episode of episodes) {
    const template = templates.get(episode.title);
    if (!template) {
      console.warn(`- ${episode.title}: no matching recurring template, skipped`);
      continue;
    }

    const host = template.hostSlug ? await findHost(template.hostSlug) : null;
    const content = getRecurringEpisodeContent(template, host?.metadata);
    const updates = {
      description: content.description,
      external_image_url: content.imageUrl,
      ...(host ? { regular_hosts: [host.id] } : {}),
    };

    console.log(`- ${episode.title} (${episode.metadata?.broadcast_date}): ${host?.title || 'no host'}`);

    if (applyChanges) {
      await cosmic.objects.updateOne(episode.id, { metadata: updates });
    }
  }
}

main().catch(error => {
  console.error('Failed to repair recurring episodes:', error);
  process.exit(1);
});