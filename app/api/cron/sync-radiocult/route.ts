import { NextRequest, NextResponse } from 'next/server';
import { syncRadioCultToCosmicEpisodes } from '@/lib/radiocult-sync-service';

/**
 * Cron job endpoint to sync RadioCult shows to Cosmic episodes
 *
 * This endpoint should be called periodically (e.g., every hour) by a cron job service
 * like Vercel Cron, GitHub Actions, or any external cron service.
 *
 * Security:
 * - Uses a CRON_SECRET environment variable to authenticate requests
 * - Returns 401 if the secret doesn't match
 *
 * Usage:
 * POST /api/cron/sync-radiocult
 * Headers:
 *   Authorization: Bearer YOUR_CRON_SECRET
 *
 * Optional query parameters:
 *   daysBack: number (default: 7) - How many days back to sync
 *   daysAhead: number (default: 30) - How many days ahead to sync
 */
export async function POST(request: NextRequest) {
  try {
    // Check for authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not set');
      return NextResponse.json({ error: 'Cron job not configured' }, { status: 500 });
    }

    // Verify the request is authorized
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get optional parameters from query string
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);
    const daysAhead = parseInt(searchParams.get('daysAhead') || '30', 10);

    console.log(
      `Starting RadioCult sync cron job (${daysBack} days back, ${daysAhead} days ahead)`
    );

    // Run the sync
    const result = await syncRadioCultToCosmicEpisodes(daysBack, daysAhead);

    // Return the results
    return NextResponse.json({
      success: result.success,
      message: `Sync complete: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors`,
      details: result.details,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in sync-radiocult cron job:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing (still requires auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
