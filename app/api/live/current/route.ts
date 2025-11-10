import { NextResponse } from 'next/server';
import { getScheduleData } from '@/lib/radiocult-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * API endpoint to get the current live event
 * This is called by the client to check if there's a live show
 */
export async function GET() {
  try {
    const { currentEvent } = await getScheduleData();

    return NextResponse.json(
      {
        success: true,
        currentEvent,
        isLive: !!currentEvent,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
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
        isLive: false,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}
