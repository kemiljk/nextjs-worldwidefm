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
  object_type?: string;
  many?: boolean;
}

interface ObjectTypeUpdateConfig {
  slug: string;
  newMetafields: Metafield[];
}

interface NewObjectTypeConfig {
  title: string;
  slug: string;
  singular: string;
  emoji: string;
  singleton: boolean;
  metafields: Metafield[];
}

// Existing object type updates (keeping featured_link for posts)
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
    ],
  },
  {
    slug: 'episode',
    newMetafields: [
      {
        title: 'External Image URL',
        key: 'external_image_url',
        type: 'text',
        required: false,
        helptext: 'URL for images stored externally (Vercel Blob). Used for cold storage of old episode images to reduce Cosmic storage costs.',
      },
    ],
  },
];

// New page configuration object types
const newObjectTypes: NewObjectTypeConfig[] = [
  {
    title: 'Editorial Page Config',
    slug: 'editorial-page-config',
    singular: 'Editorial Page Config',
    emoji: '📰',
    singleton: true,
    metafields: [
      {
        title: 'Category Order',
        key: 'category_order',
        type: 'objects',
        object_type: 'post-categories',
        many: true,
        required: false,
        helptext: 'Order categories by dragging them. Posts will be grouped under these category headers in this order.',
      },
    ],
  },
  {
    title: 'Videos Page Config',
    slug: 'videos-page-config',
    singular: 'Videos Page Config',
    emoji: '🎬',
    singleton: true,
    metafields: [
      {
        title: 'Category Order',
        key: 'category_order',
        type: 'objects',
        object_type: 'video-categories',
        many: true,
        required: false,
        helptext: 'Order categories by dragging them. Videos will be grouped under these category headers in this order.',
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

async function createObjectType(config: NewObjectTypeConfig) {
  const { title, slug, singular, emoji, singleton, metafields } = config;

  console.log(`\n🆕 Creating object type: ${slug}`);

  try {
    // Check if object type already exists
    try {
      const existingResponse = await cosmic.objectTypes.findOne(slug);
      if (existingResponse?.object_type) {
        console.log(`  └─ ✅ Object type "${slug}" already exists, skipping creation`);
        return true;
      }
    } catch {
      // Object type doesn't exist, proceed with creation
    }

    console.log(`  ├─ Creating new object type...`);
    await cosmic.objectTypes.insertOne({
      title,
      slug,
      singular,
      emoji,
      singleton,
      metafields,
    });

    console.log(`  └─ ✅ Successfully created "${slug}"`);
    return true;
  } catch (error: any) {
    console.error(`  └─ ❌ Error creating "${slug}":`, error.message || error);
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
  
  let successCount = 0;
  let failCount = 0;

  // Create new object types first
  if (newObjectTypes.length > 0) {
    console.log(`\nNew object types to create:`);
    newObjectTypes.forEach(ot => {
      console.log(`  - ${ot.slug} (${ot.singleton ? 'singleton' : 'collection'})`);
    });

    for (const objectType of newObjectTypes) {
      const success = await createObjectType(objectType);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  // Update existing object types
  if (updates.length > 0) {
    console.log(`\nUpdates to apply:`);
    updates.forEach(u => {
      console.log(`  - ${u.slug}: ${u.newMetafields.map(m => m.key).join(', ')}`);
    });

    for (const update of updates) {
      const success = await updateObjectType(update);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
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

