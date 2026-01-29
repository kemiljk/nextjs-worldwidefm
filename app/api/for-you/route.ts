import { NextRequest, NextResponse } from 'next/server';
import { getEpisodesForShows } from '@/lib/episode-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genresParam = searchParams.get('genres');
    const hostsParam = searchParams.get('hosts');
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    const genres = genresParam ? genresParam.split(',').filter(Boolean) : [];
    const hosts = hostsParam ? hostsParam.split(',').filter(Boolean) : [];

    if (genres.length === 0 && hosts.length === 0) {
      return NextResponse.json({ episodes: [] });
    }

    const episodes: any[] = [];
    const perRequestLimit = Math.max(limit + 5, 15);

    // Fetch in parallel with timeout
    const fetchWithTimeout = async (promise: Promise<any>, ms: number) => {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), ms)
      );
      return Promise.race([promise, timeout]);
    };

    const promises: Promise<any>[] = [];

    if (genres.length > 0) {
      promises.push(
        fetchWithTimeout(
          getEpisodesForShows({ genre: genres, limit: perRequestLimit, offset: 0 }),
          8000
        )
      );
    }

    if (hosts.length > 0) {
      promises.push(
        fetchWithTimeout(
          getEpisodesForShows({ host: hosts, limit: perRequestLimit, offset: 0 }),
          8000
        )
      );
    }

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.shows) {
        episodes.push(...result.value.shows);
      }
    }

    // Dedupe and sort
    const uniqueMap = new Map();
    for (const ep of episodes) {
      const key = ep.id || ep.slug;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ep);
      }
    }

    const sorted = Array.from(uniqueMap.values())
      .sort((a, b) => {
        const dateA = new Date(a.metadata?.broadcast_date || a.created_at || 0);
        const dateB = new Date(b.metadata?.broadcast_date || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, limit);

    return NextResponse.json({ episodes: sorted });
  } catch (error) {
    console.error('Error in /api/for-you:', error);
    return NextResponse.json({ episodes: [], error: 'Failed to fetch' }, { status: 500 });
  }
}
