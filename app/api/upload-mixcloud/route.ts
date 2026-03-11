import { NextRequest, NextResponse } from 'next/server';

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
      return NextResponse.json(
        { error: 'Missing audio file or title' },
        { status: 400 }
      );
    }

    const mcForm = new FormData();
    mcForm.append('mp3', audioFile);
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
        { error: `Mixcloud upload failed: ${errText || mcRes.statusText}` },
        { status: 502 }
      );
    }

    const mcData = (await mcRes.json()) as {
      key?: string;
      url?: string;
      [k: string]: unknown;
    };

    const key = mcData?.key;
    const url = mcData?.url || (key ? `https://www.mixcloud.com${key.startsWith('/') ? '' : '/'}${key}` : undefined);

    if (!url && !key) {
      return NextResponse.json(
        { error: 'Mixcloud did not return a URL or key' },
        { status: 502 }
      );
    }

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
