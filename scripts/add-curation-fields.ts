import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const bucketSlug = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '';
const readKey = process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '';
const writeKey = process.env.COSMIC_WRITE_KEY || '';

const cosmic = createBucketClient({ bucketSlug, readKey, writeKey });

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
  [key: string]: unknown;
};

interface FieldTarget {
  objectTypeSlug: string;
  field: RawMetafield;
}

// Additive, idempotent schema changes that unlock homepage/editorial curation.
const TARGETS: FieldTarget[] = [
  {
    objectTypeSlug: 'posts',
    field: {
      title: 'Related Shows',
      key: 'related_shows',
      type: 'objects',
      object_type: 'episode',
      many: true,
      required: false,
      helptext:
        'Link specific shows/episodes to this editorial piece (e.g. for special projects or brand partnerships). They will be displayed at the foot of the article.',
    },
  },
  {
    objectTypeSlug: 'homepage',
    field: {
      title: 'Archive Shows',
      key: 'archive_shows',
      type: 'objects',
      object_type: 'episode',
      many: true,
      required: false,
      helptext:
        'Hand-pick episodes to feature in the "From the Archive" section. Leave empty to auto-select random archive episodes.',
    },
  },
];

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

async function fetchExistingMetafields(slug: string): Promise<RawMetafield[]> {
  const response = await cosmic.objectTypes.findOne(slug);
  if (!response?.object_type) {
    throw new Error(`Object type "${slug}" not found`);
  }
  return (response.object_type.metafields || []) as RawMetafield[];
}

async function updateMetafieldsViaRest(
  slug: string,
  metafields: Record<string, unknown>[]
): Promise<void> {
  const url = `https://api.cosmicjs.com/v3/buckets/${bucketSlug}/object-types/${slug}`;
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
    payload = JSON.parse(text);
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

async function updateMetafieldsViaSdk(
  slug: string,
  metafields: Record<string, unknown>[]
): Promise<void> {
  await cosmic.objectTypes.updateOne(slug, { metafields });
}

async function updateWithRetries(
  slug: string,
  metafields: Record<string, unknown>[]
): Promise<void> {
  const attempts = [
    { label: 'REST PATCH', fn: () => updateMetafieldsViaRest(slug, metafields) },
    { label: 'SDK updateOne', fn: () => updateMetafieldsViaSdk(slug, metafields) },
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
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'object'
              ? JSON.stringify(error)
              : String(error);
        const isRetryable =
          message.includes('503') ||
          message.includes('timeout') ||
          message.includes('ETIMEDOUT') ||
          message.includes('ECONNRESET');

        console.warn(`  ├─ ${attempt.label} failed: ${message.slice(0, 200)}`);
        if (!isRetryable || retry === 3) break;

        const delayMs = retry * 5000;
        console.log(`  ├─ Waiting ${delayMs / 1000}s before retry...`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function addField({ objectTypeSlug, field }: FieldTarget): Promise<boolean> {
  console.log(`\n📦 Object type: ${objectTypeSlug} → adding "${field.key}"`);

  try {
    const existingMetafields = await fetchExistingMetafields(objectTypeSlug);
    console.log(`  ├─ Found ${existingMetafields.length} existing metafields`);

    if (existingMetafields.some(f => f.key === field.key)) {
      console.log(`  └─ ✅ "${field.key}" already exists, skipping`);
      return true;
    }

    // Preserve existing metafields verbatim - sanitizing them strips nested
    // properties (e.g. the `seo` parent field's `children`) and fails validation.
    const updatedMetafields = [
      ...(existingMetafields as unknown as Record<string, unknown>[]),
      sanitizeMetafieldForSchemaUpdate(field),
    ];

    await updateWithRetries(objectTypeSlug, updatedMetafields);

    const verified = await fetchExistingMetafields(objectTypeSlug);
    if (!verified.some(f => f.key === field.key)) {
      throw new Error(`Update appeared to succeed but "${field.key}" was not found on re-fetch`);
    }

    console.log(`  └─ ✅ Successfully added "${field.key}" to "${objectTypeSlug}"`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  └─ ❌ Error updating "${objectTypeSlug}":`, message);
    return false;
  }
}

async function main() {
  requireEnv('NEXT_PUBLIC_COSMIC_BUCKET_SLUG', bucketSlug);
  requireEnv('NEXT_PUBLIC_COSMIC_READ_KEY', readKey);
  requireEnv('COSMIC_WRITE_KEY', writeKey);

  console.log('🚀 Adding curation fields');
  console.log(`Bucket: ${bucketSlug}`);

  let failed = 0;
  for (const target of TARGETS) {
    const ok = await addField(target);
    if (!ok) failed += 1;
  }

  console.log('\n================================');
  if (failed > 0) {
    console.error(`❌ ${failed} field(s) failed.`);
    process.exit(1);
  }
  console.log('✅ All curation fields are in place.');
}

main();
