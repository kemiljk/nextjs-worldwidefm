import { NextRequest, NextResponse } from 'next/server';
import { del, isVercelBlobUrl } from '@/lib/blob-client';
import { uploadMediaToRadioCult } from '@/lib/radiocult-upload';

// Must be a literal — Next.js rejects imported segment config. Keep in sync with lib/upload-config.ts.
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const cleanupOnly = formData.get('cleanupOnly') === 'true';
    const mediaUrl = formData.get('mediaUrl') as string | null;

    if (cleanupOnly) {
      if (!mediaUrl || !isVercelBlobUrl(mediaUrl)) {
        return NextResponse.json(
          { error: 'No temporary blob URL provided for cleanup' },
          { status: 400 }
        );
      }

      try {
        await del(mediaUrl);
        return NextResponse.json({ success: true, cleaned: true });
      } catch (cleanupError) {
        console.error('Failed to delete temporary blob:', cleanupError);
        return NextResponse.json(
          {
            success: false,
            error: cleanupError instanceof Error ? cleanupError.message : 'Cleanup failed',
          },
          { status: 500 }
        );
      }
    }

    const file = formData.get('media') as File | null;
    const requestedFileName = formData.get('fileName') as string | null;
    const metadataRaw = formData.get('metadata') as string | null;
    const cleanup = formData.get('cleanup') !== 'false';

    if (!file && !mediaUrl) {
      return NextResponse.json({ error: 'No file or mediaUrl provided' }, { status: 400 });
    }

    let parsedMetadata: Record<string, string> = {};
    if (metadataRaw) {
      try {
        parsedMetadata = JSON.parse(metadataRaw) as Record<string, string>;
      } catch (error) {
        console.error('Error parsing metadata:', error);
      }
    }

    const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
    const secretKey = process.env.RADIOCULT_SECRET_KEY;

    if (!stationId || !secretKey) {
      if (cleanup && mediaUrl && isVercelBlobUrl(mediaUrl)) {
        await del(mediaUrl).catch(() => undefined);
      }

      return NextResponse.json(
        {
          success: false,
          error: 'RadioCult credentials not configured',
          mediaUrl: mediaUrl || undefined,
        },
        { status: 500 }
      );
    }

    const result = await uploadMediaToRadioCult({
      mediaUrl: mediaUrl || undefined,
      file: file || undefined,
      fileName: requestedFileName || undefined,
      metadata: parsedMetadata,
      stationId,
      secretKey,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          radiocultError: result.radiocultError,
          mediaUrl: result.mediaUrl,
          mp3Diagnostics: result.mp3Diagnostics,
        },
        {
          status:
            result.status && result.status >= 400 && result.status < 500 ? result.status : 502,
        }
      );
    }

    if (cleanup && mediaUrl && isVercelBlobUrl(mediaUrl)) {
      try {
        await del(mediaUrl);
      } catch (cleanupError) {
        console.error('Failed to delete temporary blob after successful upload:', cleanupError);
      }
    }

    return NextResponse.json({
      success: true,
      radiocultMediaId: result.radiocultMediaId,
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload media',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
