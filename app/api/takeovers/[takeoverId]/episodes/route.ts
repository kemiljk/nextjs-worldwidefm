import { NextRequest, NextResponse } from 'next/server';
import { getEpisodesForShows } from '@/lib/episode-service';
import { transformShowToViewData } from '@/lib/cosmic-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ takeoverId: string }> }
) {
  try {
    const { takeoverId } = await params;
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    const response = await getEpisodesForShows({
      takeover: takeoverId,
      limit,
      offset,
    });

    const transformedShows = (response.shows || []).map(transformShowToViewData);
    const hasNext = transformedShows.length === limit && offset + limit < (response.total || 0);

    return NextResponse.json({
      shows: transformedShows,
      hasNext,
      total: response.total || 0,
    });
  } catch (error) {
    console.error('Error fetching takeover episodes:', error);
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 });
  }
}

