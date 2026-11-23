/**
 * In-memory stand-in for Cosmic's v3 objects read API. Tests seed objects and send real
 * HTTP-shaped requests through it, so they check what a query returns rather than how
 * the code built it.
 *
 * It also reproduces Cosmic behaviour that has caused production defects:
 * - `$and` is silently ignored beside a `metadata.*` condition (bbdc357). Checked live:
 *   dropped beside `$in`/`$lte` on metadata fields, kept beside `title` or `slug`.
 * - A `$regex` containing a literal `\u` escape fails with HTTP 500 (7a11c3f).
 * - An empty result is a 404 with "No objects found".
 */

export interface FakeCosmicObject {
  id: string;
  type: string;
  slug: string;
  title: string;
  status?: 'published' | 'draft';
  created_at?: string;
  metadata: Record<string, unknown>;
}

type Query = Record<string, unknown>;

class FakeCosmicError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Cosmic paths like `metadata.genres` hold related objects or their ids.
function resolve(value: unknown, path: string[]): unknown[] {
  if (path.length === 0) return [value];
  if (Array.isArray(value)) return value.flatMap(item => resolve(item, path));
  if (value && typeof value === 'object') {
    return resolve((value as Record<string, unknown>)[path[0]], path.slice(1));
  }
  return [];
}

function comparable(value: unknown): unknown {
  return value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value;
}

function matchesCondition(values: unknown[], condition: unknown): boolean {
  const candidates = values.flatMap(value => (Array.isArray(value) ? value : [value]));
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    return candidates.some(value => comparable(value) === condition);
  }
  return Object.entries(condition as Record<string, unknown>).every(([operator, operand]) => {
    switch (operator) {
      case '$regex': {
        if (/\\u/.test(String(operand))) {
          throw new FakeCosmicError(500, 'Invalid regular expression');
        }
        const flags = String((condition as { $options?: string }).$options ?? '');
        const pattern = new RegExp(String(operand), flags);
        return candidates.some(value => typeof value === 'string' && pattern.test(value));
      }
      case '$options':
        return true;
      case '$in':
        return candidates.some(value => (operand as unknown[]).includes(comparable(value)));
      case '$nin':
        return !candidates.some(value => (operand as unknown[]).includes(comparable(value)));
      case '$ne':
        return !candidates.some(value => comparable(value) === operand);
      case '$exists':
        return candidates.some(value => value !== undefined && value !== null) === operand;
      case '$lt':
        return candidates.some(value => String(value) < String(operand));
      case '$lte':
        return candidates.some(value => String(value) <= String(operand));
      case '$gt':
        return candidates.some(value => String(value) > String(operand));
      case '$gte':
        return candidates.some(value => String(value) >= String(operand));
      default:
        throw new FakeCosmicError(400, `Unsupported operator ${operator}`);
    }
  });
}

function matches(object: FakeCosmicObject, query: Query): boolean {
  const hasMetadataFilter = Object.keys(query).some(key => key.startsWith('metadata.'));
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$and') {
      return hasMetadataFilter || (condition as Query[]).every(part => matches(object, part));
    }
    if (key === '$or') return (condition as Query[]).some(part => matches(object, part));
    if (key.startsWith('$')) throw new FakeCosmicError(400, `Unsupported operator ${key}`);
    return matchesCondition(resolve(object, key.split('.')), condition);
  });
}

function sortBy(objects: FakeCosmicObject[], sort: string | null) {
  if (!sort) return objects;
  const descending = sort.startsWith('-');
  const path = sort.replace(/^-/, '').split('.');
  return [...objects].sort((a, b) => {
    const left = String(resolve(a, path)[0] ?? '');
    const right = String(resolve(b, path)[0] ?? '');
    return descending ? right.localeCompare(left) : left.localeCompare(right);
  });
}

// `props` keeps only the listed paths, through arrays of related objects too.
function pick(value: unknown, paths: string[][]): unknown {
  if (paths.some(path => path.length === 0)) return structuredClone(value);
  if (Array.isArray(value)) return value.map(item => pick(item, paths));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const key of new Set(paths.map(path => path[0]))) {
    if (!(key in value)) continue;
    const rest = paths.filter(path => path[0] === key).map(path => path.slice(1));
    result[key] = pick((value as Record<string, unknown>)[key], rest);
  }
  return result;
}

export function createFakeCosmic(seed: FakeCosmicObject[]) {
  const objects = seed.map(object => ({ status: 'published' as const, ...object }));

  function find(query: Query, params: URLSearchParams) {
    const status = params.get('status') ?? 'published';
    const found = sortBy(
      objects.filter(
        object => (status === 'any' || object.status === status) && matches(object, query)
      ),
      params.get('sort')
    );
    if (found.length === 0) throw new FakeCosmicError(404, 'No objects found');
    const skip = Number(params.get('skip') ?? 0);
    const limit = Number(params.get('limit') ?? found.length);
    const props = params
      .get('props')
      ?.split(',')
      .map(prop => prop.split('.'));
    return {
      objects: found
        .slice(skip, skip + limit)
        .map(object => (props ? pick(object, props) : structuredClone(object))),
      total: found.length,
    };
  }

  async function fetch(input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (
      url.hostname !== 'api.cosmicjs.com' ||
      !/^\/v3\/buckets\/[^/]+\/objects$/.test(url.pathname)
    ) {
      throw new Error(`Unexpected request to ${url.origin}${url.pathname}`);
    }
    try {
      return Response.json(
        find(JSON.parse(url.searchParams.get('query') ?? '{}'), url.searchParams)
      );
    } catch (error) {
      if (!(error instanceof FakeCosmicError)) throw error;
      return Response.json(
        { status: error.status, message: error.message },
        { status: error.status }
      );
    }
  }

  return { fetch };
}
