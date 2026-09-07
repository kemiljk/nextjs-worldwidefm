import { NextRequest, NextResponse } from 'next/server';
import { cacheLife, cacheTag } from 'next/cache';
import { getSearchPage, searchPageSchema, type SearchPageParams } from '@/lib/search-page';

async function cachedSearch(params: SearchPageParams, yesterday: string) {
  'use cache';
  cacheLife('latest');
  cacheTag('episodes', 'posts', 'videos', 'hosts', 'takeovers');
  return getSearchPage(params, yesterday);
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const parsed = searchPageSchema.safeParse({
    type: search.get('type') ?? undefined,
    searchTerm: search.get('q') ?? undefined,
    genre: search.getAll('genre'),
    location: search.getAll('location'),
    host: search.getAll('host'),
    limit: search.get('limit') ?? undefined,
    offset: search.get('offset') ?? undefined,
    after: search.get('after') ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  try {
    const result = await cachedSearch(parsed.data, yesterday.toISOString().slice(0, 10));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Search is temporarily unavailable. Please try again.' },
      { status: 502 }
    );
  }
}
