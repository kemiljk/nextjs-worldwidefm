import { NextRequest, NextResponse } from 'next/server';
import { createWeeklyRecurringShows } from '@/lib/create-weekly-shows';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    let authHeader: string | null = null;
    try {
      authHeader = request.headers.get('authorization');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('prerender')) {
        return NextResponse.json({ error: 'Prerender aborted' }, { status: 200 });
      }
      throw err;
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await createWeeklyRecurringShows();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CRON create-weekly-shows] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create weekly shows',
      },
      { status: 500 }
    );
  }
}
