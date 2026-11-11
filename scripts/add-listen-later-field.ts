import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: (process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY) || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function addListenLaterField() {
  const slug = 'users';
  const newMetafield = {
    title: 'Listen Later',
    key: 'listen_later',
    type: 'objects',
    object_type: 'episodes',
    many: true,
    required: false,
    helptext: 'Episodes saved for later listening.',
  };

  console.log(`\n📦 Updating object type: ${slug}`);

  try {
    const response = await cosmic.objectTypes.findOne(slug);

    if (!response?.object_type) {
      console.error(`  └─ ❌ Object type "${slug}" not found`);
      return;
    }

    const existingMetafields = response.object_type.metafields || [];
    const exists = existingMetafields.find((m: any) => m.key === 'listen_later');

    if (exists) {
      console.log(`  └─ ✅ "listen_later" already exists, skipping`);
      return;
    }

    const updatedMetafields = [...existingMetafields, newMetafield];

    await cosmic.objectTypes.updateOne(slug, {
      metafields: updatedMetafields,
    });

    console.log(`  └─ ✅ Successfully added "listen_later" to "${slug}"`);
  } catch (error: any) {
    console.error(`  └─ ❌ Error updating "${slug}":`, error.message || error);
  }
}

addListenLaterField();
