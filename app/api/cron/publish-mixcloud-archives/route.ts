import { NextRequest, NextResponse } from 'next/server';
import { publishPendingMixcloudArchives } from '@/lib/mixcloud-archive-publisher';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await publishPendingMixcloudArchives();
    if (result.failed.length) {
      console.error('[CRON publish-mixcloud-archives] Some lookups failed:', result.failed);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CRON publish-mixcloud-archives] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish Mixcloud archives',
      },
      { status: 500 }
    );
  }
}
