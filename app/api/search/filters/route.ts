import { connection, NextResponse } from 'next/server';
import { getSearchFacets } from '@/lib/public-facets';

export async function GET() {
  // Read the tagged data cache on each request; do not prerender a second stale response.
  await connection();
  try {
    return NextResponse.json(await getSearchFacets(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Filters are temporarily unavailable. Please try again.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
