import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function run() {
  try {
    console.log('Fetching object types...');
    const resp = await cosmic.objectTypes.find();
    const slugs = resp.object_types.map((ot: any) => ot.slug);
    console.log('Available Object Types:', slugs);

    if (slugs.includes('members')) {
      const membersResp = await cosmic.objectTypes.findOne('members');
      console.log('Members Metafields:', membersResp.object_type.metafields.map((m: any) => m.key));
    } else {
      console.warn('CRITICAL: "members" object type is MISSING!');
    }

    if (slugs.includes('users')) {
      const usersResp = await cosmic.objectTypes.findOne('users');
      console.log('Users Metafields:', usersResp.object_type.metafields.map((m: any) => m.key));
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

run();
