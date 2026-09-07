import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createHash } from 'node:crypto';
import { contentLifetime, contentTags } from './content-cache-policy';

export interface PublicReadOptions {
  props?: string;
  depth?: number;
  limit?: number;
  skip?: number;
  after?: string;
  sort?: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
}

export class CosmicReadError extends Error {
  constructor(
    public status: number,
    operation: string
  ) {
    super(`Cosmic ${operation} failed (${status})`);
  }
}

async function fetchObjects(queryJson: string, optionsJson: string) {
  const bucket = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
  const readKey = process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
  if (!bucket || !readKey) throw new Error('Cosmic public read configuration is missing');
  const query = JSON.parse(queryJson);
  const options = JSON.parse(optionsJson);
  if (options.props && !options.props.split(',').includes('type')) options.props += ',type';
  const url = new URL(`https://api.cosmicjs.com/v3/buckets/${encodeURIComponent(bucket)}/objects`);
  url.searchParams.set('read_key', readKey);
  url.searchParams.set('status', 'published');
  url.searchParams.set('query', queryJson);
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const operation = typeof query.type === 'string' ? query.type : 'object';
  const fingerprint = createHash('sha256')
    .update(queryJson + optionsJson)
    .digest('hex')
    .slice(0, 12);
  // This function runs only on cache fills. Never log the URL, keys or content.
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = performance.now();
    let status = 0;
    let bytes = 0;
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
      status = response.status;
      const text = await response.text();
      bytes = Buffer.byteLength(text);
      if (status === 404) {
        // Only Cosmic's documented empty result is an absence, not a bad bucket/route.
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          throw new CosmicReadError(status, operation);
        }
        if (/no objects found/i.test(String(body.message || body.error || ''))) {
          return { objects: [], total: 0 };
        }
      }
      if (!response.ok) throw new CosmicReadError(status, operation);
      const body = JSON.parse(text);
      if (!Array.isArray(body.objects)) throw new CosmicReadError(502, operation);
      if (
        body.objects.some((object: { type?: string }) =>
          ['users', 'members'].includes(object.type || '')
        )
      ) {
        throw new Error('Account reads cannot use the public cache');
      }
      return { objects: body.objects, total: body.total ?? body.objects.length };
    } catch (error) {
      const retryable = status === 429 || status >= 500 || status === 0;
      if (attempt || !retryable) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 250));
    } finally {
      console.info(
        JSON.stringify({
          event: 'cosmic.read',
          operation,
          fingerprint,
          status,
          bytes,
          durationMs: Math.round(performance.now() - start),
          attempt: attempt + 1,
        })
      );
    }
  }
  throw new CosmicReadError(503, operation);
}

async function readCached(queryJson: string, optionsJson: string) {
  'use cache: remote';
  const query = JSON.parse(queryJson);
  cacheLife(contentLifetime(query.type));
  cacheTag(...contentTags(query.type || 'object', query.slug));
  if ((JSON.parse(optionsJson).depth ?? 1) > 0) cacheTag('content-relationships');
  // Failures must throw so refreshes cannot replace healthy content with an empty value.
  return fetchObjects(queryJson, optionsJson);
}

export async function getPublicObjects(
  query: Record<string, unknown>,
  options: PublicReadOptions = {}
) {
  const { status, ...publicQuery } = query;
  if (status && status !== 'published')
    throw new Error('Preview reads cannot use the public cache');
  if (['users', 'members'].includes(String(query.type))) {
    throw new Error('Account reads cannot use the public cache');
  }
  return readCached(JSON.stringify(stableValue(publicQuery)), JSON.stringify(stableValue(options)));
}

export async function getPublicObject(
  query: Record<string, unknown>,
  options: PublicReadOptions = {}
) {
  const result = await getPublicObjects(query, { ...options, limit: 1 });
  return { object: result.objects[0] || null };
}
