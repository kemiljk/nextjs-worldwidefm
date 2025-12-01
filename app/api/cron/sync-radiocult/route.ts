import { NextResponse } from 'next/server';
import { syncApprovedShowsToRadioCult } from '@/lib/sync-radiocult';

export async function POST() {
  try {
    const result = await syncApprovedShowsToRadioCult();
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Unknown error' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, syncedCount: result.syncedCount ?? 0 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync with RadioCult',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}

