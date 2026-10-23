import dotenv from 'dotenv';
import { createBucketClient } from '@cosmicjs/sdk';
import { getRecurringEpisodeBody, hostImageUrls, RECURRING_SHOWS } from '@/lib/recurring-shows';
import { findHostTaxonomy } from '@/lib/create-weekly-shows';

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
    .props('id,title,metadata.description,metadata.image,metadata.external_image_url')
    .status('any');

  return response.object || null;
}

async function main() {
  requireEnvironment(
    'NEXT_PUBLIC_COSMIC_BUCKET_SLUG',
    process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || ''
  );
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
    .props(
      'id,title,metadata.broadcast_date,metadata.description,metadata.body_text,metadata.image,metadata.external_image_url'
    )
    .limit(1000);

  const episodes = response.objects || [];
  console.log(
    `${applyChanges ? 'Applying' : 'Dry run:'} ${episodes.length} upcoming recurring draft(s)`
  );

  for (const episode of episodes) {
    const template = templates.get(episode.title);
    if (!template) {
      console.warn(`- ${episode.title}: no matching recurring template, skipped`);
      continue;
    }

    const host = template.hostSlug ? await findHost(template.hostSlug) : null;
    // Older drafts put the copy in `description` and copied the host image into
    // `external_image_url`, which overrides any image staff upload. Move the copy
    // and drop the copied image (the site falls back to the host image), but never
    // replace copy staff have already written.
    const metadata = episode.metadata || {};
    const updates: Record<string, unknown> = {
      ...(host ? { regular_hosts: [host.id], ...(await findHostTaxonomy(host.id, cosmic)) } : {}),
    };

    if (!metadata.body_text?.trim()) {
      updates.body_text = getRecurringEpisodeBody(template, host?.metadata);
      updates.description = '';
    }
    if (
      metadata.external_image_url &&
      hostImageUrls(host?.metadata).includes(metadata.external_image_url)
    ) {
      updates.external_image_url = '';
    }

    console.log(
      `- ${episode.title} (${episode.metadata?.broadcast_date}): ${host?.title || 'no host'} → ${Object.keys(updates).join(', ')}`
    );

    if (applyChanges) {
      await cosmic.objects.updateOne(episode.id, { metadata: updates });
    }
  }
}

main().catch(error => {
  console.error('Failed to repair recurring episodes:', error);
  process.exit(1);
});
