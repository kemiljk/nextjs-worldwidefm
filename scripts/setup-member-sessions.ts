import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
const apply = process.argv.includes('--apply');
const bucketSlug = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
const readKey = (process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY);
const writeKey = process.env.COSMIC_WRITE_KEY;
if (!bucketSlug || !readKey || !writeKey) throw new Error('Cosmic credentials are required');
const cosmic = createBucketClient({ bucketSlug, readKey, writeKey });

async function main() {
  try {
    const existing = await cosmic.objectTypes.findOne('member-sessions');
    if (existing.object_type) {
      const expiry = existing.object_type.metafields?.find(
        (field: { key: string }) => field.key === 'expires_at'
      );
      if (!expiry) throw new Error('Existing member-sessions type is missing expires_at');
      console.log('Member session type and expiry field already exist.');
      return;
    }
  } catch (error) {
    if ((error as { status?: number })?.status !== 404) throw error;
  }
  if (!apply) {
    console.log('Dry run: would create member-sessions object type.');
    return;
  }
  await cosmic.objectTypes.insertOne({
    title: 'Member Sessions',
    slug: 'member-sessions',
    singular: 'Member Session',
    emoji: '🔑',
    metafields: [{ title: 'Expires At', key: 'expires_at', type: 'text', required: true }],
  });
  const result = await cosmic.objectTypes.findOne('member-sessions');
  if (
    !result.object_type?.metafields?.some((field: { key: string }) => field.key === 'expires_at')
  ) {
    throw new Error('Could not verify member session type');
  }
  console.log('Created and verified member-sessions object type.');
}

main().catch(error => {
  console.error('Member session setup failed:', error);
  process.exitCode = 1;
});
