import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { archiveMasterToDrive, getDriveMasterConfig } from '@/lib/google-drive-master';

export const maxDuration = 800;

function authorized(request: Request): boolean {
  const expected = process.env.GOOGLE_DRIVE_STAFF_SECRET || '';
  const received = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  // Require a generated high-entropy credential, not a short password.
  if (expected.length < 43 || received.length > 512) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

export async function POST(request: Request) {
  const config = getDriveMasterConfig();
  if (
    process.env.GOOGLE_DRIVE_ARCHIVE_ENABLED !== 'true' ||
    !config ||
    !process.env.GOOGLE_DRIVE_STAFF_SECRET ||
    process.env.GOOGLE_DRIVE_STAFF_SECRET.length < 43
  ) {
    return NextResponse.json({ error: 'Google Drive archive is not configured' }, { status: 503 });
  }
  if (!authorized(request))
    return NextResponse.json({ error: 'Invalid staff access key' }, { status: 401 });
  try {
    const data = await request.json();
    if (data?.action === 'check') return NextResponse.json({ success: true });
    if (
      typeof data?.blobUrl !== 'string' ||
      typeof data?.fileName !== 'string' ||
      typeof data?.broadcastDate !== 'string' ||
      typeof data?.episodeId !== 'string'
    ) {
      return NextResponse.json({ error: 'Missing upload details' }, { status: 400 });
    }
    const result = await archiveMasterToDrive({
      blobUrl: data.blobUrl,
      fileName: data.fileName,
      broadcastDate: data.broadcastDate,
      episodeId: data.episodeId,
      config,
      signal: request.signal,
    });
    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      alreadyArchived: result.alreadyArchived,
    });
  } catch (error) {
    console.error(
      '[upload-drive] Drive archive failed',
      error instanceof Error ? error.message : 'unknown error'
    );
    return NextResponse.json(
      {
        success: false,
        error:
          'Google Drive upload could not be confirmed. The audio has been kept; check the Drive folder before retrying.',
      },
      { status: 502 }
    );
  }
}
