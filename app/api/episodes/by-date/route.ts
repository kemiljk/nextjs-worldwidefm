import { NextRequest, NextResponse } from 'next/server';
import { getEpisodes } from '@/lib/episode-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid or missing date parameter. Use ?date=YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const response = await getEpisodes({
      broadcastDate: date,
      limit: 50,
      offset: 0,
    });

    return NextResponse.json({
      episodes: response.episodes,
      total: response.total,
    });
  } catch (error) {
    console.error('Error in /api/episodes/by-date:', error);
    return NextResponse.json(
      { episodes: [], error: 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
