/**
 * Server-side search query construction for Cosmic.
 *
 * Cosmic runs `$regex` across the entire collection, so result limits only control
 * page size, never search scope. Pagination stays small because response latency
 * scales with payload size, not with the number of documents scanned.
 *
 * @see https://www.cosmicjs.com/docs/api/queries
 */

export const SEARCH_MIN_TOKEN_LENGTH = 2;
export const SEARCH_PAGE_SIZE = 20;

export interface CosmicRegexCondition {
  $regex: string;
  $options: 'i';
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function tokenizeSearchQuery(
  searchTerm: string,
  minTokenLength: number = SEARCH_MIN_TOKEN_LENGTH
): string[] {
  return searchTerm
    .trim()
    .split(/[\s,+/|]+/)
    .map(token => token.replace(/^[^a-zA-Z0-9À-ÿ]+|[^a-zA-Z0-9À-ÿ]+$/g, ''))
    .filter(token => token.length >= minTokenLength);
}

/**
 * Multiple tokens compile to chained lookaheads so they match in any order and with
 * arbitrary text between them: "Sam Bhok Karl" matches "Sam Bhok w/ Karl Bos".
 */
export function buildSearchRegex(searchTerm: string | undefined): CosmicRegexCondition | null {
  const tokens = tokenizeSearchQuery(searchTerm ?? '');
  if (tokens.length === 0) {
    return null;
  }

  if (tokens.length === 1) {
    return { $regex: escapeRegex(tokens[0]), $options: 'i' };
  }

  return {
    $regex: tokens.map(token => `(?=.*${escapeRegex(token)})`).join(''),
    $options: 'i',
  };
}

/**
 * Assigns the search condition to a single field key rather than `$and`/`$or`.
 * Cosmic silently discards `$and` when the query also has sibling field conditions
 * (e.g. `metadata.broadcast_date`), which returns the unfiltered collection.
 */
export function applySearchToQuery(
  query: Record<string, unknown>,
  searchTerm: string | undefined,
  field: string = 'title'
): void {
  const regex = buildSearchRegex(searchTerm);
  if (!regex) {
    return;
  }

  query[field] = regex;
}

export function hasUsableSearchTerm(searchTerm: string | undefined): boolean {
  return tokenizeSearchQuery(searchTerm ?? '').length > 0;
}
