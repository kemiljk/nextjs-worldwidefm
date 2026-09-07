import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

// Marker block types so the homepage's auto-generated sections (archive,
// genre selector, video, editorial feed) can be dragged into `page_order`
// and positioned anywhere. They carry no config - the homepage supplies the
// content. When absent from page_order, the homepage falls back to rendering
// these blocks in their original fixed positions, so existing pages are
// unaffected.
interface BlockType {
  title: string;
  slug: string;
  singular: string;
  emoji: string;
}

const BLOCK_TYPES: BlockType[] = [
  { title: 'Genre Selector Block', slug: 'genre-selector', singular: 'Genre Selector Block', emoji: '🎚️' },
  { title: 'Archive Block', slug: 'archive-block', singular: 'Archive Block', emoji: '🗄️' },
  { title: 'Video Block', slug: 'video-block', singular: 'Video Block', emoji: '🎬' },
  { title: 'Editorial Block', slug: 'editorial-block', singular: 'Editorial Block', emoji: '📰' },
];

function requireEnv(name: string, value: string | undefined) {
  if (!value || !value.trim()) {
    console.error(`❌ Missing ${name}. Add it to .env.local before running this script.`);
    process.exit(1);
  }
}

async function createBlockType(block: BlockType): Promise<boolean> {
  console.log(`\n📦 Block type: ${block.slug}`);
  try {
    try {
      const existing = await cosmic.objectTypes.findOne(block.slug);
      if (existing?.object_type) {
        console.log(`  └─ ✅ "${block.slug}" already exists, skipping`);
        return true;
      }
    } catch {
      // Not found - proceed to create.
    }

    await cosmic.objectTypes.insertOne({
      title: block.title,
      slug: block.slug,
      singular: block.singular,
      emoji: block.emoji,
      singleton: true,
      metafields: [],
    });

    console.log(`  └─ ✅ Created "${block.slug}"`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`  └─ ❌ Error creating "${block.slug}":`, message);
    return false;
  }
}

async function main() {
  requireEnv('NEXT_PUBLIC_COSMIC_BUCKET_SLUG', process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
  requireEnv('COSMIC_WRITE_KEY', process.env.COSMIC_WRITE_KEY);

  console.log('🚀 Creating homepage block types');
  console.log(`Bucket: ${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}`);

  let failed = 0;
  for (const block of BLOCK_TYPES) {
    const ok = await createBlockType(block);
    if (!ok) failed += 1;
  }

  console.log('\n================================');
  if (failed > 0) {
    console.error(`❌ ${failed} block type(s) failed.`);
    process.exit(1);
  }
  console.log('✅ All homepage block types are in place.');
}

main();
