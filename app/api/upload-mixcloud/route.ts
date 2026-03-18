import { NextRequest, NextResponse } from 'next/server';
import { inspectMp3Structure } from '@/lib/mp3-utils';

export const maxDuration = 300;

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
