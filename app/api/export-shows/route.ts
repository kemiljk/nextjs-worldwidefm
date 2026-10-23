import { NextRequest, NextResponse } from 'next/server';
import { exportShows, listShows } from '@/lib/export-shows-service';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  const includeDrafts = request.nextUrl.searchParams.get('includeDrafts') === 'true';

  try {
    if (request.nextUrl.searchParams.get('format') === 'json') {
      const shows = await listShows({ hostOrSeriesSlug: slug, includeDrafts });
      return NextResponse.json({ shows });
    }

    const { csv, filename } = await exportShows({ hostOrSeriesSlug: slug, includeDrafts });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
