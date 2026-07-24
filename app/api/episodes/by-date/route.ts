import { NextRequest, NextResponse } from 'next/server';
import { cosmic } from '@/lib/cosmic-config';
import { EpisodeObject } from '@/lib/cosmic-types';

const BY_DATE_PROPS =
  'id,slug,title,type,status,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.tracklist,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const includeDrafts = searchParams.get('includeDrafts') === 'true';

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid or missing date parameter. Use ?date=YYYY-MM-DD' },
        { status: 400 }
      );
    }

    let query = cosmic.objects
      .find({
        type: 'episode',
        'metadata.broadcast_date': date,
      })
      .props(BY_DATE_PROPS)
      .limit(50)
      .skip(0)
      .sort('metadata.broadcast_time')
      .depth(1);

    if (includeDrafts) {
      query = query.status('any');
    }

    const response = await query;
    const episodes = (response.objects || []) as EpisodeObject[];

    return NextResponse.json({
      episodes,
      total: response.total || episodes.length,
    });
  } catch (error) {
    console.error('Error in /api/episodes/by-date:', error);
    return NextResponse.json(
      { episodes: [], error: 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
