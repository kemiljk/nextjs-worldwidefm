import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

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
  fileSize: number;
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
    fileSize: buffer.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MIXCLOUD_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mixcloud not configured (MIXCLOUD_ACCESS_TOKEN)' },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const imageUrl = formData.get('imageUrl') as string | null;

    if (!audioFile || !title) {
      return NextResponse.json({ error: 'Missing audio file or title' }, { status: 400 });
    }

    // Determine MIME type based on file extension
    const originalType = audioFile.type || 'audio/mpeg';
    const fileName = audioFile.name || 'audio.mp3';
    const ext = fileName.split('.').pop()?.toLowerCase();

    // For MP3 files, inspect the structure for diagnostics
    let mp3Diagnostics: ReturnType<typeof inspectMp3Structure> | undefined;
    if (ext === 'mp3' || fileName.toLowerCase().endsWith('.mp3')) {
      try {
        const audioArrayBuffer = await audioFile.arrayBuffer();
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

    // Use the original file directly - don't re-create Blob from buffer
    // Re-creating Blob from buffer can corrupt the file
    const mcForm = new FormData();
    mcForm.append('mp3', audioFile, fileName);
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

    const mcRes = await fetch('https://api.mixcloud.com/upload/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: mcForm,
    });

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
  }
}
