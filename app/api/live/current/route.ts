import { NextResponse } from 'next/server';
import { getScheduleData, findMatchingShow } from '@/lib/radiocult-service';
import { getCurrentScheduleShow } from '@/lib/schedule-service';

/**
 * API endpoint to get the current live event
 * This is called by the client to check if there's a live show
 * Also includes matching Cosmic show info for linking to episode detail pages
 */
export async function GET() {
  try {
    const [{ currentEvent }, scheduleShow] = await Promise.all([
      getScheduleData(),
      getCurrentScheduleShow(),
    ]);

    let matchingShowSlug: string | null = null;

    if (currentEvent) {
      const matchingShow = await findMatchingShow(currentEvent);
      matchingShowSlug = matchingShow?.slug || null;
    }

    return NextResponse.json(
      {
        success: true,
        currentEvent,
        matchingShowSlug,
        scheduleShow,
        isLive: !!currentEvent,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching current live event:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch current live event',
        currentEvent: null,
        matchingShowSlug: null,
        scheduleShow: null,
        isLive: false,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  }
}
