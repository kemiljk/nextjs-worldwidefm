import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OBJECT_TYPE = 'episode';

const NEW_METAFIELDS = [
  {
    title: 'Raw Media URL',
    key: 'raw_media_url',
    type: 'text',
    required: false,
    helptext:
      'Temporary Vercel Blob URL for audio that failed to reach RadioCult. Used by staff to retry the upload.',
  },
  {
    title: 'Page Link',
    key: 'page_link',
    type: 'text',
    required: false,
    helptext: 'Outbound link for the archived episode, normally the Mixcloud cloudcast URL.',
  },
];

const bucketSlug = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
const readKey = process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
const writeKey = process.env.COSMIC_WRITE_KEY;

if (!bucketSlug || !readKey || !writeKey) {
  console.error('❌ Missing Cosmic credentials in .env.local');
  process.exit(1);
}

const baseUrl = `https://api.cosmicjs.com/v3/buckets/${bucketSlug}`;

async function readMetafieldKeys(): Promise<{ keys: string[]; metafields: { key: string }[] }> {
  const response = await fetch(
    `${baseUrl}/object-types/${OBJECT_TYPE}?read_key=${readKey}&cb=${Date.now()}`
  );

  if (!response.ok) {
    throw new Error(`Could not read object type "${OBJECT_TYPE}" (HTTP ${response.status})`);
  }

  const { object_type } = (await response.json()) as {
    object_type?: { metafields?: { key: string }[] };
  };

  if (!object_type) {
    throw new Error(`Object type "${OBJECT_TYPE}" not found`);
  }

  const metafields = object_type.metafields || [];
  return { keys: metafields.map(field => field.key), metafields };
}

async function addMediaRecoveryFields() {
  console.log(`\n📦 Updating object type: ${OBJECT_TYPE}`);

  const { keys, metafields } = await readMetafieldKeys();
  const missing = NEW_METAFIELDS.filter(field => !keys.includes(field.key));

  for (const field of NEW_METAFIELDS) {
    if (keys.includes(field.key)) {
      console.log(`  ├─ ✅ "${field.key}" already exists, skipping`);
    }
  }

  if (missing.length === 0) {
    console.log('  └─ Nothing to do');
    return;
  }

  console.log(`  ├─ ➕ Adding: ${missing.map(field => field.key).join(', ')}`);

  try {
    const response = await fetch(`${baseUrl}/object-types/${OBJECT_TYPE}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${writeKey}` },
      body: JSON.stringify({ metafields: [...metafields, ...missing] }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      // Adding a metafield migrates every episode, which regularly outlives
      // Cosmic's gateway timeout even though the change lands. Verify instead.
      console.log(`  ├─ ⚠️  Cosmic returned HTTP ${response.status}, verifying...`);
    }
  } catch (error) {
    console.log(
      `  ├─ ⚠️  Request did not return cleanly (${error instanceof Error ? error.message : error}), verifying...`
    );
  }

  const { keys: keysAfter } = await readMetafieldKeys();
  const stillMissing = missing.filter(field => !keysAfter.includes(field.key));

  if (stillMissing.length > 0) {
    console.error(`  └─ ❌ Still missing: ${stillMissing.map(field => field.key).join(', ')}`);
    process.exit(1);
  }

  console.log(`  └─ ✅ Added: ${missing.map(field => field.key).join(', ')}`);
}

addMediaRecoveryFields().catch((error: unknown) => {
  console.error('  └─ ❌ Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
