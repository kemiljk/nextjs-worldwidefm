import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Adds a plain-text "Placeholder Title" and an optional duration to each day's
// schedule entry. An entry with a placeholder title and no episode shows on the
// schedule until a published episode starts in the same slot, then yields to it.
//
//   bun run scripts/add-schedule-placeholder-field.ts           # dry run
//   bun run scripts/add-schedule-placeholder-field.ts --apply   # write to Cosmic
const apply = process.argv.includes('--apply');

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

type Metafield = {
  key?: string;
  type?: string;
  children?: Metafield[];
  repeater_fields?: Record<string, unknown>[];
  [property: string]: unknown;
};

const NEW_FIELDS = [
  {
    title: 'Placeholder Title',
    key: 'placeholder_title',
    type: 'text',
    required: false,
    helptext:
      'Plain-text show name to display until the host submits the show. Leave Episode empty. It is replaced automatically when a published episode starts in the same slot.',
  },
  {
    title: 'Override Duration',
    key: 'override_duration',
    type: 'text',
    required: false,
    helptext: 'Hours (e.g. 2) or HH:MM. Defaults to 1 hour for a placeholder.',
  },
];

function withPlaceholderFields(metafield: Metafield): { metafield: Metafield; added: string[] } {
  const added: string[] = [];
  const children = (metafield.children || []).map(child => {
    if (child.type !== 'repeater' || child.key !== 'show') return child;
    const existing = new Set((child.repeater_fields || []).map(field => field.key));
    const missing = NEW_FIELDS.filter(field => !existing.has(field.key));
    added.push(...missing.map(field => `${metafield.key}.${field.key}`));
    return { ...child, repeater_fields: [...(child.repeater_fields || []), ...missing] };
  });
  return { metafield: { ...metafield, children }, added };
}

async function main() {
  const response = await cosmic.objectTypes.findOne('schedule');
  const metafields: Metafield[] = response?.object_type?.metafields || [];

  const added: string[] = [];
  const updated = metafields.map(metafield => {
    if (metafield.type !== 'parent') return metafield;
    const result = withPlaceholderFields(metafield);
    added.push(...result.added);
    return result.metafield;
  });

  if (added.length === 0) {
    console.log('Schedule already has placeholder_title and override_duration on every day.');
    return;
  }
  console.log(`${apply ? 'Adding' : 'Would add'}: ${added.join(', ')}`);
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update the schedule object type.');
    return;
  }

  await cosmic.objectTypes.updateOne('schedule', { metafields: updated });
  console.log('Updated the schedule object type.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
