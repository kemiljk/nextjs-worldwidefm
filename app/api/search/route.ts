import { NextResponse } from 'next/server';
import { searchContent } from '@/lib/actions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || undefined;
  const source = searchParams.get('source') || undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 0, 1), 200) : 100;
  try {
    console.log('[api/search] query=', q, 'source=', source, 'limit=', limit);
    const results = await searchContent(q, source || undefined, limit);
    console.log('[api/search] results_count=', Array.isArray(results) ? results.length : 0);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[api/search] error', err);
    return NextResponse.json({ results: [], error: 'search_failed' }, { status: 500 });
  }
}
