import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function addScheduleRemindersField() {
  const response = await cosmic.objectTypes.findOne('users');
  const existingMetafields = response?.object_type?.metafields || [];
  if (existingMetafields.some((field: { key?: string }) => field.key === 'schedule_reminders')) {
    console.log('schedule_reminders already exists');
    return;
  }

  await cosmic.objectTypes.updateOne('users', {
    metafields: [
      ...existingMetafields,
      {
        title: 'Schedule Reminders',
        key: 'schedule_reminders',
        type: 'json',
        required: false,
        helptext: 'Weekly programme reminder preferences.',
      },
    ],
  });
  console.log('Added schedule_reminders to users');
}

addScheduleRemindersField().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
