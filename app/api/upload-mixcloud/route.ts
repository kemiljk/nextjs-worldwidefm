import { NextRequest, NextResponse } from 'next/server';
import { inspectMp3Structure } from '@/lib/mp3-utils';
import { del, isVercelBlobUrl } from '@/lib/blob-client';

export const maxDuration = 300;
const MIXCLOUD_UPLOAD_TIMEOUT_MS = 4.5 * 60 * 1000;

function getAudioMimeType(fileName: string, originalType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
  if (ext === 'flac') return 'audio/flac';
  if (
    !originalType ||
    originalType === 'application/octet-stream' ||
    originalType === 'audio/mp3'
  ) {
    return 'audio/mpeg';
  }

  return originalType;
}

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
    shouldCleanupMediaUrl = formData.get('cleanup') === 'true';
    mediaUrlForCleanup = mediaUrl || undefined;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mixcloud not configured (MIXCLOUD_ACCESS_TOKEN)' },
        { status: 503 }
      );
    }

    if ((!audioFile && !mediaUrl) || !title) {
      return NextResponse.json({ error: 'Missing audio file or title' }, { status: 400 });
    }

    let audioBlob: File | Blob;
    let originalType: string;
    let fileName: string;

    if (mediaUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MIXCLOUD_UPLOAD_TIMEOUT_MS);

      try {
        const mediaRes = await fetch(mediaUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!mediaRes.ok) {
          throw new Error(`Failed to fetch media from URL: ${mediaRes.statusText}`);
        }

        const fetchedBlob = await mediaRes.blob();
        fileName = requestedFileName?.trim() || mediaUrl.split('/').pop() || 'audio.mp3';
        originalType = fetchedBlob.type || 'audio/mpeg';
        audioBlob = new Blob([await fetchedBlob.arrayBuffer()], {
          type: getAudioMimeType(fileName, originalType),
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          {
            error: `Failed to fetch media: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
          },
          { status: 400 }
        );
      }
    } else if (audioFile) {
      audioBlob = audioFile;
      originalType = audioFile.type || 'audio/mpeg';
      fileName = requestedFileName?.trim() || audioFile.name || 'audio.mp3';
    } else {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
    }

    const ext = fileName.split('.').pop()?.toLowerCase();

    // For MP3 files, inspect the structure for diagnostics
    let mp3Diagnostics: ReturnType<typeof inspectMp3Structure> | undefined;
    if (ext === 'mp3' || fileName.toLowerCase().endsWith('.mp3')) {
      try {
        const audioArrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = Buffer.from(audioArrayBuffer);
        mp3Diagnostics = inspectMp3Structure(audioBuffer);
        console.log('🔍 Mixcloud MP3 inspection:', {
          fileName,
          originalType,
          ...mp3Diagnostics,
        });

        if (!mp3Diagnostics.hasId3Header) {
          console.warn('⚠️ Mixcloud upload: MP3 lacks ID3 header');
        }
        if (!mp3Diagnostics.hasMpegFrameSync) {
          console.warn('⚠️ Mixcloud upload: MP3 lacks MPEG frame sync');
        }
        if (mp3Diagnostics.paddingPattern === 'FF-dominant') {
          console.warn('⚠️ Mixcloud upload: MP3 has FF-dominant padding');
        }
      } catch (inspectError) {
        console.warn('⚠️ Could not inspect MP3 structure:', inspectError);
      }
    }

    const mcForm = new FormData();
    mcForm.append('mp3', audioBlob, fileName);
    mcForm.append('name', title);
    if (description?.trim()) {
      mcForm.append('description', description.trim());
    }
    mcForm.append('percentage_music', '100');

    if (imageUrl?.trim()) {
      try {
        const imgRes = await fetch(imageUrl.trim());
        if (imgRes.ok) {
          const imgBlob = await imgRes.blob();
          const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
          mcForm.append('picture', imgBlob, `cover.${ext}`);
        }
      } catch (imgErr) {
        console.warn('Could not attach image to Mixcloud upload:', imgErr);
      }
    }

    const mcAbortController = new AbortController();
    const mcTimeoutId = setTimeout(() => mcAbortController.abort(), MIXCLOUD_UPLOAD_TIMEOUT_MS);
    let mcRes: Response;
    try {
      mcRes = await fetch('https://api.mixcloud.com/upload/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: mcForm,
        signal: mcAbortController.signal,
      });
    } finally {
      clearTimeout(mcTimeoutId);
    }

    if (!mcRes.ok) {
      const errText = await mcRes.text();
      console.error('Mixcloud upload failed:', mcRes.status, errText);
      return NextResponse.json(
        {
          error: `Mixcloud upload failed: ${errText || mcRes.statusText}`,
          mp3Diagnostics,
        },
        { status: 502 }
      );
    }

    const mcData = (await mcRes.json()) as {
      key?: string;
      url?: string;
      [k: string]: unknown;
    };

    const key = mcData?.key;
    const url =
      mcData?.url ||
      (key ? `https://www.mixcloud.com${key.startsWith('/') ? '' : '/'}${key}` : undefined);

    if (!url && !key) {
      return NextResponse.json({ error: 'Mixcloud did not return a URL or key' }, { status: 502 });
    }

    console.log('✅ Mixcloud upload SUCCESS:', { url, key, fileName });

    return NextResponse.json({
      url: url || (key ? `https://www.mixcloud.com/${key}` : ''),
      key: key || undefined,
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
