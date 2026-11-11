import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: (process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY) || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function main() {
  if (!process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || !process.env.COSMIC_WRITE_KEY)
    throw new Error('Cosmic credentials are required');
  const response = await cosmic.objectTypes.findOne('users');
  const fields = response.object_type?.metafields || [];
  if (fields.some((field: { key?: string }) => field.key === 'episode_reminders')) {
    console.log('episode_reminders already exists');
    return;
  }
  if (!process.argv.includes('--apply')) {
    console.log('Dry run: would add users.episode_reminders JSON field');
    return;
  }
  const metafields = [
    ...fields,
    {
      title: 'Episode Reminders',
      key: 'episode_reminders',
      type: 'json',
      required: false,
      helptext: 'One-off show reminder preferences.',
    },
  ];
  const responseWrite = await fetch(
    `https://api.cosmicjs.com/v3/buckets/${encodeURIComponent(process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG!)}/object-types/users`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.COSMIC_WRITE_KEY}`,
      },
      body: JSON.stringify({ metafields }),
      signal: AbortSignal.timeout(45000),
    }
  );
  if (!responseWrite.ok) throw new Error(`Cosmic schema update failed (${responseWrite.status})`);
  const verified = await cosmic.objectTypes.findOne('users');
  if (
    !verified.object_type?.metafields?.some(
      (field: { key?: string }) => field.key === 'episode_reminders'
    )
  )
    throw new Error('Field missing after update');
  console.log('Added users.episode_reminders');
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
