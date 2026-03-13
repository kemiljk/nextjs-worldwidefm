import { NextRequest, NextResponse } from 'next/server';
import { del, isVercelBlobUrl } from '@/lib/blob-client';

export const maxDuration = 300;

const RADIOCULT_FETCH_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Inspect MP3 file structure for diagnostics.
 * Returns info about ID3 header, MPEG frame sync, and padding patterns.
 */
function inspectMp3Structure(buffer: Buffer): {
  hasId3Header: boolean;
  hasMpegFrameSync: boolean;
  firstBytes: string;
  id3Version?: string;
  paddingPattern?: string;
} {
  // Check for ID3 header (starts with "ID3")
  const hasId3Header = buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3';

  // Check for MPEG frame sync (0xFFE or 0xFFF at start, or after ID3 tag)
  let syncOffset = 0;
  if (hasId3Header && buffer.length >= 10) {
    // ID3v2 tag size is stored in bytes 6-9 as a synchsafe integer
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    syncOffset = 10 + size;
  }

  const hasMpegFrameSync =
    buffer.length > syncOffset + 1 &&
    (buffer[syncOffset] === 0xff || buffer[syncOffset] === 0xfe) &&
    (buffer[syncOffset + 1] & 0xe0) === 0xe0;

  // Get first 8 bytes as hex for debugging
  const firstBytes = buffer.slice(0, Math.min(8, buffer.length)).toString('hex').toUpperCase();

  // Determine ID3 version if present
  let id3Version: string | undefined;
  if (hasId3Header && buffer.length >= 4) {
    const major = buffer[3];
    id3Version = `ID3v2.${major}`;
  }

  // Check padding pattern after ID3 or at start (FF vs 00)
  let paddingPattern: string | undefined;
  if (buffer.length >= 16) {
    const paddingStart = hasId3Header ? 10 : 0;
    const ffCount = buffer.slice(paddingStart, paddingStart + 8).filter(b => b === 0xff).length;
    const zeroCount = buffer.slice(paddingStart, paddingStart + 8).filter(b => b === 0x00).length;
    if (ffCount > 4) paddingPattern = 'FF-dominant';
    else if (zeroCount > 4) paddingPattern = '00-dominant';
    else paddingPattern = 'mixed';
  }

  return {
    hasId3Header,
    hasMpegFrameSync,
    firstBytes,
    id3Version,
    paddingPattern,
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎵 Media upload API called');

    const formData = await request.formData();
    const file = formData.get('media') as File | null;
    const mediaUrl = formData.get('mediaUrl') as string | null;
    const requestedFileName = formData.get('fileName') as string | null;
    const metadata = formData.get('metadata') as string;

    if (!file && !mediaUrl) {
      console.error('❌ No file or mediaUrl provided in request');
      return NextResponse.json({ error: 'No file or mediaUrl provided' }, { status: 400 });
    }

    let finalFile: File | Blob;
    let finalFileName: string;
    let finalFileType: string;

    if (mediaUrl) {
      console.log('🔗 Fetching media from URL:', mediaUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RADIOCULT_FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(mediaUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`Failed to fetch media from URL: ${res.statusText}`);
        }

        const blob = await res.blob();
        finalFile = blob;
        finalFileType = blob.type || 'audio/mpeg';
        if (requestedFileName?.trim()) {
          finalFileName = requestedFileName.trim();
        } else {
          try {
            const url = new URL(mediaUrl);
            finalFileName = url.pathname.split('/').pop() || 'media-file';
          } catch {
            finalFileName = 'media-file';
          }
        }

        console.log('✅ Media fetched from URL:', {
          size: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
          type: finalFileType,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('❌ Error fetching media from URL:', fetchError);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch media: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
            mediaUrl: mediaUrl || undefined,
          },
          { status: 400 }
        );
      }
    } else if (file) {
      finalFile = file;
      finalFileName = requestedFileName?.trim() || file.name;
      finalFileType = file.type || 'audio/mpeg';
      console.log('🎵 Media file received:', {
        name: finalFileName,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.type,
      });
    } else {
      return NextResponse.json({ error: 'No file or mediaUrl provided' }, { status: 400 });
    }

    // Vercel Blob and browsers often return application/octet-stream for audio files missing ID3 tags.
    // RadioCult API rejects these. Ensure the correct MIME type based on the file extension.
    const originalFileType = finalFileType;
    const ext = finalFileName.split('.').pop()?.toLowerCase();
    if (ext === 'mp3') finalFileType = 'audio/mpeg';
    else if (ext === 'wav') finalFileType = 'audio/wav';
    else if (ext === 'ogg') finalFileType = 'audio/ogg';
    else if (ext === 'aac') finalFileType = 'audio/aac';
    else if (ext === 'm4a' || ext === 'mp4') finalFileType = 'audio/mp4';
    else if (ext === 'flac') finalFileType = 'audio/flac';
    else if (
      !finalFileType ||
      finalFileType === 'application/octet-stream' ||
      finalFileType === 'audio/mp3'
    )
      finalFileType = 'audio/mpeg';

    // Log type normalization for debugging
    if (originalFileType !== finalFileType) {
      console.log('🔄 MIME type normalized:', {
        from: originalFileType,
        to: finalFileType,
        extension: ext,
      });
    }

    let parsedMetadata: Record<string, string> = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata) as Record<string, string>;
        console.log('📝 Metadata parsed:', parsedMetadata);
      } catch (error) {
        console.error('❌ Error parsing metadata:', error);
      }
    }

    const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
    const secretKey = process.env.RADIOCULT_SECRET_KEY;

    if (!stationId || !secretKey) {
      console.error('❌ RadioCult credentials not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'RadioCult credentials not configured',
          mediaUrl: mediaUrl || undefined,
        },
        { status: 500 }
      );
    }

    const arrayBuffer = await finalFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Inspect MP3 structure for problematic files
    if (ext === 'mp3' || finalFileName.toLowerCase().endsWith('.mp3')) {
      const structure = inspectMp3Structure(buffer);
      console.log('🔍 MP3 structure inspection:', {
        ...structure,
        fileName: finalFileName,
        originalType: originalFileType,
        normalizedType: finalFileType,
      });

      // Warn about potentially problematic files
      if (!structure.hasId3Header) {
        console.warn('⚠️ MP3 lacks ID3 header - may cause upload issues');
      }
      if (!structure.hasMpegFrameSync) {
        console.warn('⚠️ MP3 lacks MPEG frame sync marker - may be corrupted or non-standard');
      }
      if (structure.paddingPattern === 'FF-dominant') {
        console.warn('⚠️ MP3 has FF-dominant padding - RadioCult may reject this');
      }
    }

    const fileBlob = new Blob([buffer], { type: finalFileType });
    const rcForm = new FormData();
    rcForm.append('stationMedia', fileBlob, finalFileName);
    rcForm.append('metadata', JSON.stringify(parsedMetadata));

    console.log('📡 Attempting RadioCult upload...');

    const rcAbortController = new AbortController();
    const rcTimeoutId = setTimeout(() => rcAbortController.abort(), RADIOCULT_FETCH_TIMEOUT_MS);

    // Capture MP3 structure for error diagnostics
    let mp3Structure: ReturnType<typeof inspectMp3Structure> | undefined;
    if (ext === 'mp3' || finalFileName.toLowerCase().endsWith('.mp3')) {
      mp3Structure = inspectMp3Structure(buffer);
    }

    try {
      const rcRes = await fetch(`https://api.radiocult.fm/api/station/${stationId}/media/track`, {
        method: 'POST',
        headers: { 'x-api-key': secretKey },
        body: rcForm,
        signal: rcAbortController.signal,
      });
      clearTimeout(rcTimeoutId);

      if (!rcRes.ok) {
        const rcErrorText = await rcRes.text();
        console.warn('❌ RadioCult upload FAILED (status:', rcRes.status, '):', rcErrorText);
        return NextResponse.json(
          {
            success: false,
            error: `RadioCult upload failed: ${rcErrorText}`,
            radiocultError: rcErrorText,
            mediaUrl: mediaUrl || undefined,
            mp3Diagnostics: mp3Structure,
          },
          { status: 502 }
        );
      }

      const rcJson = await rcRes.json();
      const radiocultMediaId = rcJson.track?.id;

      if (!radiocultMediaId) {
        console.warn('❌ RadioCult response missing track id:', rcJson);
        return NextResponse.json(
          {
            success: false,
            error: 'RadioCult did not return a media ID',
            mediaUrl: mediaUrl || undefined,
          },
          { status: 502 }
        );
      }

      console.log('✅ RadioCult upload SUCCESS - Media ID:', radiocultMediaId);

      if (mediaUrl && isVercelBlobUrl(mediaUrl)) {
        console.log('🧹 Cleaning up temporary Vercel Blob:', mediaUrl);
        try {
          await del(mediaUrl);
          console.log('✅ Temporary Vercel Blob deleted');
        } catch (cleanupError) {
          console.error('⚠️ Failed to delete temporary Vercel Blob:', cleanupError);
        }
      }

      return NextResponse.json({
        success: true,
        radiocultMediaId,
      });
    } catch (rcError) {
      clearTimeout(rcTimeoutId);
      console.error('❌ RadioCult upload error:', rcError);
      const errorMessage = rcError instanceof Error ? rcError.message : 'Unknown upload error';
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          mediaUrl: mediaUrl || undefined,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('❌ Error uploading media:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error details:', {
      message: errorMessage,
      type: (error as Error)?.constructor?.name,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to upload media',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
