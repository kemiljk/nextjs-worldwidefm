import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const bucketSlug = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '';
const readKey = process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '';
const writeKey = process.env.COSMIC_WRITE_KEY || '';

const cosmic = createBucketClient({
  bucketSlug,
  readKey,
  writeKey,
});

const OBJECT_TYPE_SLUG = 'regular-hosts';
const NEW_METAFIELD = {
  title: 'Mixcloud Username',
  key: 'mixcloud_username',
  type: 'text',
  required: false,
  helptext:
    'Mixcloud account username for co-host tagging on uploads (must be an accepted Host in the WWFM Mixcloud dashboard).',
};

type RawMetafield = {
  id?: string;
  title: string;
  key: string;
  type: string;
  required?: boolean;
  helptext?: string;
  object_type?: string;
  many?: boolean;
  media_validation_type?: string;
  options?: unknown;
  value?: unknown;
  is_root?: boolean;
  [key: string]: unknown;
};

function requireEnv(name: string, value: string) {
  if (!value.trim()) {
    console.error(`❌ Missing ${name}. Add it to .env.local before running this script.`);
    process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeMetafieldForSchemaUpdate(field: RawMetafield): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    title: field.title,
    key: field.key,
    type: field.type,
    required: Boolean(field.required),
    helptext: field.helptext || '',
  };

  if (field.id) sanitized.id = field.id;
  if (field.object_type) sanitized.object_type = field.object_type;
  if (field.many !== undefined) sanitized.many = field.many;
  if (field.media_validation_type) sanitized.media_validation_type = field.media_validation_type;
  if (field.options) sanitized.options = field.options;

  return sanitized;
}

async function fetchExistingMetafields(): Promise<RawMetafield[]> {
  const response = await cosmic.objectTypes.findOne(OBJECT_TYPE_SLUG);
  if (!response?.object_type) {
    throw new Error(`Object type "${OBJECT_TYPE_SLUG}" not found`);
  }
  return (response.object_type.metafields || []) as RawMetafield[];
}

async function updateMetafieldsViaRest(metafields: Record<string, unknown>[]): Promise<void> {
  const url = `https://api.cosmicjs.com/v3/buckets/${bucketSlug}/object-types/${OBJECT_TYPE_SLUG}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${writeKey}`,
    },
    body: JSON.stringify({ metafields }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`REST PATCH failed (${response.status}): ${text.slice(0, 500)}`);
  }

  let payload: { message?: string; object_type?: unknown; object?: unknown } | null = null;
  try {
    payload = JSON.parse(text) as { message?: string; object_type?: unknown; object?: unknown };
  } catch {
    payload = null;
  }

  if (payload?.message === 'Route not found') {
    throw new Error('Cosmic REST PATCH returned "Route not found"');
  }

  if (!payload?.object_type && !payload?.object) {
    throw new Error(`Unexpected REST response: ${text.slice(0, 500)}`);
  }
}

async function updateMetafieldsViaSdk(metafields: Record<string, unknown>[]): Promise<void> {
  await cosmic.objectTypes.updateOne(OBJECT_TYPE_SLUG, { metafields });
}

async function updateWithRetries(metafields: Record<string, unknown>[]): Promise<void> {
  const attempts = [
    { label: 'REST PATCH', fn: () => updateMetafieldsViaRest(metafields) },
    { label: 'SDK updateOne', fn: () => updateMetafieldsViaSdk(metafields) },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    for (let retry = 1; retry <= 3; retry += 1) {
      try {
        console.log(`  ├─ Trying ${attempt.label} (attempt ${retry}/3)...`);
        await attempt.fn();
        console.log(`  ├─ ${attempt.label} succeeded`);
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isRetryable =
          message.includes('503') ||
          message.includes('timeout') ||
          message.includes('ETIMEDOUT') ||
          message.includes('ECONNRESET');

        console.warn(`  ├─ ${attempt.label} failed: ${message.slice(0, 200)}`);

        if (!isRetryable || retry === 3) {
          break;
        }

        const delayMs = retry * 5000;
        console.log(`  ├─ Waiting ${delayMs / 1000}s before retry...`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function printManualFallback() {
  console.error(
    '\nCosmic object-type writes are timing out from their API (503). Add the field manually:\n' +
      '  1. Open Cosmic dashboard → Bucket → Object types → regular-hosts\n' +
      '  2. Add metafield: Title "Mixcloud Username", Key "mixcloud_username", Type "Text"\n' +
      '  3. Re-run this script to verify (it will skip if the field already exists)\n'
  );
}

async function addMixcloudUsernameField() {
  requireEnv('NEXT_PUBLIC_COSMIC_BUCKET_SLUG', bucketSlug);
  requireEnv('NEXT_PUBLIC_COSMIC_READ_KEY', readKey);
  requireEnv('COSMIC_WRITE_KEY', writeKey);

  console.log(`\n📦 Updating object type: ${OBJECT_TYPE_SLUG}`);
  console.log(`  ├─ Bucket: ${bucketSlug}`);

  try {
    const existingMetafields = await fetchExistingMetafields();
    console.log(`  ├─ Found ${existingMetafields.length} existing metafields`);

    if (existingMetafields.some(field => field.key === 'mixcloud_username')) {
      console.log(`  └─ ✅ "mixcloud_username" already exists, skipping`);
      return;
    }

    const updatedMetafields = [
      ...existingMetafields.map(sanitizeMetafieldForSchemaUpdate),
      NEW_METAFIELD,
    ];

    console.log(
      `  ├─ Adding mixcloud_username (${updatedMetafields.length} total metafields, schema-only payload)...`
    );

    await updateWithRetries(updatedMetafields);

    const verified = await fetchExistingMetafields();
    if (!verified.some(field => field.key === 'mixcloud_username')) {
      throw new Error('Update appeared to succeed but mixcloud_username was not found on re-fetch');
    }

    console.log(`  └─ ✅ Successfully added "mixcloud_username" to "${OBJECT_TYPE_SLUG}"`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  └─ ❌ Error updating "${OBJECT_TYPE_SLUG}":`, message);
    printManualFallback();
    process.exit(1);
  }
}

addMixcloudUsernameField();
