import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function inspectSchema() {
  try {
    const response = await cosmic.objectTypes.findOne('users');
    console.log('Users Schema Metafields:', JSON.stringify(response.object_type.metafields.map((m: any) => m.key), null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

inspectSchema();
