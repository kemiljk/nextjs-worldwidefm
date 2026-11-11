import dotenv from 'dotenv';
import { createBucketClient } from '@cosmicjs/sdk';
import { RECURRING_SHOWS } from '../lib/recurring-shows';

dotenv.config({ path: '.env.local' });
const apply = process.argv.includes('--apply');
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: (process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY) || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function main() {
  if (
    !process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG ||
    !(process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY) ||
    !process.env.COSMIC_WRITE_KEY
  )
    throw new Error('Cosmic credentials are required');
  let exists = true;
  try {
    await cosmic.objectTypes.findOne('recurring-shows');
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    exists = false;
  }

  // Validate all relationships and capture the copy the current job actually uses
  // before making any changes. Existing template objects are never overwritten.
  const templates = [];
  for (const template of RECURRING_SHOWS) {
    if (!template.hostSlug) throw new Error(`${template.title} has no host slug`);
    const { object: host } = await cosmic.objects
      .findOne({ type: 'regular-hosts', slug: template.hostSlug })
      .props('id,title,metadata.description')
      .status('any');
    if (!host?.id) throw new Error(`Host not found: ${template.hostSlug}`);
    templates.push({
      template,
      host,
      description: host.metadata?.description?.trim() || template.description,
    });
  }
  console.log(
    `${apply ? 'Apply' : 'Dry run'}: recurring-shows type ${exists ? 'already exists' : 'will be created'}`
  );
  for (const entry of templates)
    console.log(
      `  ${entry.template.title}: ${entry.template.day} ${entry.template.startTime}, host ${entry.host.title}`
    );
  if (!apply) return;
  if (!exists) {
    await cosmic.objectTypes.insertOne({
      title: 'Recurring Shows',
      slug: 'recurring-shows',
      singular: 'Recurring Show',
      emoji: '📻',
      metafields: [
        {
          title: 'Host or Series',
          key: 'host',
          type: 'object',
          object_type: 'regular-hosts',
          required: true,
        },
        {
          title: 'Broadcast Day',
          key: 'day',
          type: 'text',
          required: true,
          helptext: 'Enter Monday, Tuesday, Wednesday, Thursday, Friday, Saturday or Sunday.',
        },
        {
          title: 'Start Time',
          key: 'start_time',
          type: 'text',
          required: true,
          helptext: 'UK local time in 24-hour HH:MM format, for example 08:00.',
        },
        {
          title: 'Duration (hours)',
          key: 'duration_hours',
          type: 'text',
          required: true,
          helptext: 'Duration in hours, for example 2 or 1.5.',
        },
        {
          title: 'Placeholder Copy',
          key: 'description',
          type: 'textarea',
          required: false,
          helptext: 'Copied to new episode pages; edit before the weekly pages are created.',
        },
      ],
    });
    console.log('Created recurring-shows object type');
  }
  for (const { template, host, description } of templates) {
    const slug = template.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let found = false;
    try {
      found = Boolean(
        (await cosmic.objects.findOne({ type: 'recurring-shows', slug }).props('id').status('any'))
          .object
      );
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
    if (found) {
      console.log(`Skipped existing ${template.title}`);
      continue;
    }
    await cosmic.objects.insertOne({
      type: 'recurring-shows',
      title: template.title,
      slug,
      status: 'published',
      metadata: {
        host: host.id,
        day: template.day,
        start_time: template.startTime,
        duration_hours: String(template.durationHours),
        description,
      },
    });
    console.log(`Created ${template.title}`);
  }
}
main().catch(error => {
  console.error('Recurring show setup failed:', error);
  process.exit(1);
});
