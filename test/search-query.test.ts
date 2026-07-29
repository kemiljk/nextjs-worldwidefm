import { describe, expect, it } from 'bun:test';
import {
  applySearchToQuery,
  buildSearchRegex,
  hasUsableSearchTerm,
  tokenizeSearchQuery,
} from '@/lib/search-query';

describe('tokenizeSearchQuery', () => {
  it('splits on whitespace and common separators', () => {
    expect(tokenizeSearchQuery('Sam Bhok Karl')).toEqual(['Sam', 'Bhok', 'Karl']);
    expect(tokenizeSearchQuery('Sam/Bhok|Karl')).toEqual(['Sam', 'Bhok', 'Karl']);
  });

  it('strips punctuation from token edges', () => {
    expect(tokenizeSearchQuery('Sam, Bhok!')).toEqual(['Sam', 'Bhok']);
  });

  it('drops tokens shorter than the minimum length', () => {
    expect(tokenizeSearchQuery('Sam B Karl')).toEqual(['Sam', 'Karl']);
  });

  it('returns nothing for whitespace-only input', () => {
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });
});

describe('buildSearchRegex', () => {
  it('uses a plain substring pattern for a single token', () => {
    expect(buildSearchRegex('Bhok')).toEqual({ $regex: 'Bhok', $options: 'i' });
  });

  it('chains lookaheads so multi-word queries match in any order', () => {
    expect(buildSearchRegex('Sam Bhok Karl')).toEqual({
      $regex: '(?=.*Sam)(?=.*Bhok)(?=.*Karl)',
      $options: 'i',
    });
  });

  it('escapes regex characters in user input', () => {
    expect(buildSearchRegex('foo.bar')).toEqual({ $regex: 'foo\\.bar', $options: 'i' });
  });

  it('returns null when no token meets the minimum length', () => {
    expect(buildSearchRegex('a')).toBeNull();
    expect(buildSearchRegex('')).toBeNull();
    expect(buildSearchRegex(undefined)).toBeNull();
  });
});

describe('applySearchToQuery', () => {
  it('matches the real episode title regardless of interleaved words', () => {
    const regex = buildSearchRegex('Sam Bhok Karl');
    expect(regex).not.toBeNull();
    const compiled = new RegExp(regex!.$regex, regex!.$options);

    expect(compiled.test('Sam Bhok w/ Karl Bos')).toBe(true);
    expect(compiled.test('Karl Bos w/ Sam Bhok')).toBe(true);
    expect(compiled.test('Sam Bhok')).toBe(false);
  });

  it('assigns to a single field key so sibling filters are preserved', () => {
    const query: Record<string, unknown> = {
      type: 'episode',
      status: 'published',
      'metadata.broadcast_date': { $lte: '2026-07-28' },
    };

    applySearchToQuery(query, 'Sam Bhok');

    expect(query).toEqual({
      type: 'episode',
      status: 'published',
      'metadata.broadcast_date': { $lte: '2026-07-28' },
      title: { $regex: '(?=.*Sam)(?=.*Bhok)', $options: 'i' },
    });
    expect(query.$and).toBeUndefined();
    expect(query.$or).toBeUndefined();
  });

  it('leaves the query untouched when there is no usable term', () => {
    const query: Record<string, unknown> = { type: 'episode' };
    applySearchToQuery(query, '  ');
    expect(query).toEqual({ type: 'episode' });
  });
});

describe('hasUsableSearchTerm', () => {
  it('reports whether a query will produce a search condition', () => {
    expect(hasUsableSearchTerm('Sam')).toBe(true);
    expect(hasUsableSearchTerm('a')).toBe(false);
    expect(hasUsableSearchTerm(undefined)).toBe(false);
  });
});
