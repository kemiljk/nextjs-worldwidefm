import dotenv from 'dotenv';
import { createBucketClient } from '@cosmicjs/sdk';
import { RECURRING_SHOWS } from '@/lib/recurring-shows';

dotenv.config({ path: '.env.local' });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function main() {
  const response = await cosmic.objects
    .find({ type: 'regular-hosts', status: 'published' })
    .props('id,slug,title')
    .limit(1000);

  const hosts = response.objects || [];

  console.log('Recurring show host verification\n');

  for (const show of RECURRING_SHOWS) {
    if (!show.hostSlug) {
      console.log(`- ${show.title}: no host slug configured`);
      continue;
    }

    const host = hosts.find(entry => entry.slug === show.hostSlug);
    if (host) {
      console.log(`✓ ${show.title}: ${show.hostSlug} (${host.title})`);
    } else {
      console.log(`✗ ${show.title}: missing host slug "${show.hostSlug}"`);
    }
  }
}

main().catch(error => {
  console.error('Failed to verify recurring hosts:', error);
  process.exit(1);
});
