import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Makes the video description a rich-text editor so captions can use bold, italics,
// lists and named hyperlinks. Existing plain-text captions keep displaying as before
// until they are edited and saved.
//
//   bun run scripts/update-video-description-field.ts           # dry run
//   bun run scripts/update-video-description-field.ts --apply   # write to Cosmic
const apply = process.argv.includes('--apply');

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function main() {
  const response = await cosmic.objectTypes.findOne('videos');
  const metafields: { key?: string; type?: string; [property: string]: unknown }[] =
    response?.object_type?.metafields || [];
  const description = metafields.find(field => field.key === 'description');

  if (!description) throw new Error('videos has no description field');
  if (description.type === 'html-textarea') {
    console.log('videos.description is already rich text.');
    return;
  }

  console.log(
    `${apply ? 'Changing' : 'Would change'} videos.description: ${description.type} -> html-textarea`
  );
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update the videos object type.');
    return;
  }

  await cosmic.objectTypes.updateOne('videos', {
    metafields: metafields.map(field =>
      field.key === 'description' ? { ...field, type: 'html-textarea' } : field
    ),
  });
  console.log('Updated the videos object type.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
