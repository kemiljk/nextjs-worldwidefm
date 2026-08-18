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

const ACCENT_EQUIVALENTS: Record<string, string> = {
  a: 'aàáâãäåāăąǎæ',
  c: 'cçćĉċč',
  d: 'dďđð',
  e: 'eèéêëēĕėęě',
  g: 'gĝğġģ',
  i: 'iìíîïĩīĭįıǐ',
  l: 'lĺļľł',
  n: 'nñńņňŋ',
  o: 'oòóôõöøōŏőǒœ',
  r: 'rŕŗř',
  s: 'sśŝşšß',
  t: 'tţťŧþ',
  u: 'uùúûüũūŭůűųǔ',
  y: 'yýÿŷ',
  z: 'zźżž',
};

/** Build a regex fragment that treats common Latin diacritics as equivalent. */
export function buildAccentInsensitivePattern(value: string): string {
  const folded = foldSearchText(value);

  return Array.from(folded)
    .map(character => {
      const equivalents = ACCENT_EQUIVALENTS[character.toLowerCase()];
      const fragment = equivalents ? `[${equivalents}]` : escapeRegex(character);
      return /[a-z]/i.test(character) ? `${fragment}[\\u0300-\\u036f]*` : fragment;
    })
    .join('');
}

export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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
    return { $regex: buildAccentInsensitivePattern(tokens[0]), $options: 'i' };
  }

  return {
    $regex: tokens.map(token => `(?=.*${buildAccentInsensitivePattern(token)})`).join(''),
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
