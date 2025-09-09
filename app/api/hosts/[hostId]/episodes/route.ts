import { NextRequest, NextResponse } from 'next/server';
import { getRadioShows } from '@/lib/cosmic-service';
import { transformShowToViewData } from '@/lib/cosmic-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await params;
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    const response = await getRadioShows({
      filters: { host: hostId },
      limit,
      skip: offset,
      sort: '-metadata.broadcast_date',
    });

    // Transform episodes to show format for ShowCard compatibility
    const transformedShows = (response.objects || []).map(transformShowToViewData);

    const hasNext = transformedShows.length === limit && offset + limit < (response.total || 0);

    return NextResponse.json({
      shows: transformedShows,
      hasNext,
      total: response.total || 0,
    });
  } catch (error) {
    console.error('Error fetching host episodes:', error);
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 });
  }
}
