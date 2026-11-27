import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Adds "Blocks" to the Membership page: a repeater of content blocks shown under the
// sign-up section (image and text, plain text, call to action, FAQ).
//
//   bun run scripts/add-membership-blocks-field.ts           # dry run
//   bun run scripts/add-membership-blocks-field.ts --apply   # write to Cosmic
const apply = process.argv.includes('--apply');

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

const field = (title: string, key: string, type: string, extra: Record<string, unknown> = {}) => ({
  title,
  key,
  type,
  value: '',
  required: false,
  helptext: '',
  ...extra,
});

const BLOCKS_FIELD = {
  title: 'Blocks',
  key: 'blocks',
  type: 'repeater',
  required: false,
  helptext:
    'Content shown under the sign-up section, in this order. FAQ blocks that sit next to each other appear as one list: use Heading for the question and Body for the answer.',
  repeater_fields: [
    field('Type', 'type', 'select-dropdown', {
      value: 'image-text',
      options: [
        { key: 'Image and text', value: 'image-text' },
        { key: 'Text', value: 'text' },
        { key: 'Call to action', value: 'cta' },
        { key: 'FAQ', value: 'faq' },
      ],
    }),
    field('Heading', 'heading', 'text'),
    field('Body', 'body', 'html-textarea'),
    field('Image', 'image', 'file', { media_validation_type: 'image' }),
    field('Image Position', 'image_position', 'select-dropdown', {
      value: 'right',
      options: [
        { key: 'Left', value: 'left' },
        { key: 'Right', value: 'right' },
      ],
      helptext: 'Image and text blocks only.',
    }),
    field('Button Text', 'button_text', 'text', { helptext: 'Call to action blocks only.' }),
    field('Button Link', 'button_link', 'text', {
      helptext: 'A page on the site such as /shows, or a full https:// link.',
    }),
  ],
};

async function main() {
  const response = await cosmic.objectTypes.findOne('memberships');
  const metafields: { key?: string }[] = response?.object_type?.metafields || [];
  if (metafields.some(existing => existing.key === 'blocks')) {
    console.log('memberships already has a blocks field.');
    return;
  }

  console.log(`${apply ? 'Adding' : 'Would add'} memberships.blocks (repeater, 7 fields)`);
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update the memberships object type.');
    return;
  }

  await cosmic.objectTypes.updateOne('memberships', { metafields: [...metafields, BLOCKS_FIELD] });
  console.log('Updated the memberships object type.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
