import { createBucketClient } from '@cosmicjs/sdk';

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

interface Metafield {
  id?: string;
  title: string;
  key: string;
  type: string;
  required?: boolean;
  helptext?: string;
  value?: string | number;
}

interface ObjectTypeUpdateConfig {
  slug: string;
  newMetafields: Metafield[];
}

const updates: ObjectTypeUpdateConfig[] = [
  {
    slug: 'posts',
    newMetafields: [
      {
        title: 'Featured Link',
        key: 'featured_link',
        type: 'text',
        required: false,
        helptext: 'Optional URL to link to when this post is featured (used with is_featured)',
      },
      {
        title: 'Display Order',
        key: 'display_order',
        type: 'number',
        required: false,
        helptext: 'Order for display on the editorial page (lower numbers appear first)',
      },
    ],
  },
  {
    slug: 'videos',
    newMetafields: [
      {
        title: 'Display Order',
        key: 'display_order',
        type: 'number',
        required: false,
        helptext: 'Order for display on the videos page (lower numbers appear first)',
      },
    ],
  },
  {
    slug: 'video-categories',
    newMetafields: [
      {
        title: 'Display Order',
        key: 'display_order',
        type: 'number',
        required: false,
        helptext: 'Order for display on the videos page (lower numbers appear first)',
      },
    ],
  },
];

async function updateObjectType(config: ObjectTypeUpdateConfig) {
  const { slug, newMetafields } = config;

  console.log(`\n📦 Updating object type: ${slug}`);

  try {
    // Step 1: Get existing object type to retrieve current metafields
    console.log(`  ├─ Fetching existing object type...`);
    const response = await cosmic.objectTypes.findOne(slug);
    
    if (!response?.object_type) {
      console.error(`  └─ ❌ Object type "${slug}" not found`);
      return false;
    }

    const existingMetafields: Metafield[] = response.object_type.metafields || [];
    console.log(`  ├─ Found ${existingMetafields.length} existing metafields`);

    // Step 2: Check which new metafields already exist (by key)
    const existingKeys = new Set(existingMetafields.map((m: Metafield) => m.key));
    const metafieldsToAdd = newMetafields.filter(m => !existingKeys.has(m.key));

    if (metafieldsToAdd.length === 0) {
      console.log(`  └─ ✅ All new metafields already exist, skipping`);
      return true;
    }

    console.log(`  ├─ Adding ${metafieldsToAdd.length} new metafield(s): ${metafieldsToAdd.map(m => m.key).join(', ')}`);

    // Step 3: Merge existing metafields with new ones
    const updatedMetafields = [...existingMetafields, ...metafieldsToAdd];

    // Step 4: Update the object type with combined metafields
    console.log(`  ├─ Updating object type with ${updatedMetafields.length} total metafields...`);
    await cosmic.objectTypes.updateOne(slug, {
      metafields: updatedMetafields,
    });

    console.log(`  └─ ✅ Successfully updated "${slug}"`);
    return true;
  } catch (error: any) {
    console.error(`  └─ ❌ Error updating "${slug}":`, error.message || error);
    return false;
  }
}

async function main() {
  console.log('🚀 Cosmic Object Type Migration');
  console.log('================================\n');

  if (!process.env.COSMIC_WRITE_KEY) {
    console.error('❌ COSMIC_WRITE_KEY environment variable is required');
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG) {
    console.error('❌ NEXT_PUBLIC_COSMIC_BUCKET_SLUG environment variable is required');
    process.exit(1);
  }

  console.log(`Bucket: ${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}`);
  console.log(`Updates to apply:`);
  updates.forEach(u => {
    console.log(`  - ${u.slug}: ${u.newMetafields.map(m => m.key).join(', ')}`);
  });

  let successCount = 0;
  let failCount = 0;

  for (const update of updates) {
    const success = await updateObjectType(update);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

main();

