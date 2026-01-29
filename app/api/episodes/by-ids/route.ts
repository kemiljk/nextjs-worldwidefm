import { NextRequest, NextResponse } from 'next/server';
import { cosmic } from '@/lib/cosmic-config';

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ episodes: [] });
    }

    const response = await cosmic.objects
      .find({
        type: 'episode',
        id: { $in: ids },
      })
      .props('id,slug,title,type,metadata,created_at,modified_at')
      .depth(1)
      .status('any');

    return NextResponse.json({ episodes: response.objects || [] });
  } catch (error) {
    console.error('Error in /api/episodes/by-ids:', error);
    return NextResponse.json({ episodes: [], error: 'Failed to fetch' }, { status: 500 });
  }
}
