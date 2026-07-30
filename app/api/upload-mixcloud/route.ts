import { NextRequest, NextResponse } from 'next/server';
import { del, isVercelBlobUrl } from '@/lib/blob-client';
import { uploadMediaToMixcloud } from '@/lib/mixcloud-upload';

// Must be a literal — Next.js rejects imported segment config. Keep in sync with lib/upload-config.ts.
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  let mediaUrlForCleanup: string | undefined;
  let shouldCleanupMediaUrl = false;

  try {
    const accessToken = process.env.MIXCLOUD_ACCESS_TOKEN;
    const formData = await request.formData();

    const audioFile = formData.get('audio') as File | null;
    const mediaUrl = formData.get('mediaUrl') as string | null;
    const requestedFileName = formData.get('fileName') as string | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const imageUrl = formData.get('imageUrl') as string | null;
    const tagsJson = formData.get('tags') as string | null;
    const hostsJson = formData.get('hosts') as string | null;
    const broadcastDate = formData.get('broadcastDate') as string | null;
    const broadcastTime = formData.get('broadcastTime') as string | null;
    const duration = formData.get('duration') as string | null;

    shouldCleanupMediaUrl = formData.get('cleanup') === 'true';
    mediaUrlForCleanup = mediaUrl || undefined;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mixcloud not configured (MIXCLOUD_ACCESS_TOKEN)' },
        { status: 503 }
      );
    }

    const result = await uploadMediaToMixcloud({
      audioFile,
      mediaUrl,
      fileName: requestedFileName,
      title: title || '',
      description,
      imageUrl,
      tagsJson,
      hostsJson,
      broadcastDate,
      broadcastTime,
      duration,
      accessToken,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
        },
        { status: result.status && result.status >= 400 && result.status < 500 ? result.status : 502 }
      );
    }

    return NextResponse.json({
      url: result.url,
      key: result.key,
      warning: result.warning,
    });
  } catch (error) {
    console.error('Mixcloud upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mixcloud upload failed' },
      { status: 500 }
    );
  } finally {
    if (shouldCleanupMediaUrl && mediaUrlForCleanup && isVercelBlobUrl(mediaUrlForCleanup)) {
      try {
        await del(mediaUrlForCleanup);
      } catch (cleanupError) {
        console.error('Failed to delete temporary Mixcloud upload blob:', cleanupError);
      }
    }
  }
}
