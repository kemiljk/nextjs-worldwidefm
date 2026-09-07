import { NextRequest, NextResponse } from 'next/server';
import { getSearchPage, searchPageSchema } from '@/lib/search-page';

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
    const result = await getSearchPage(parsed.data, yesterday.toISOString().slice(0, 10));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Search is temporarily unavailable. Please try again.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
