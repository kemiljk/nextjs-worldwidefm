import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cosmic } from '@/lib/cosmic-config';

function plainTextTracklistToHtml(tracklist: string): string {
  return tracklist
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .replace(/\n/g, '<br />');
}

function revalidateEpisodeCaches(slug?: string) {
  revalidateTag('episodes', { expire: 0 });
  if (slug) {
    revalidateTag(`episode-${slug}`, { expire: 0 });
    revalidatePath(`/episode/${slug}`);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const rawTracklist = body.tracklist;
    if (typeof rawTracklist !== 'string') {
      return NextResponse.json({ error: 'tracklist must be a string' }, { status: 400 });
    }

    const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : undefined;
    const tracklist = plainTextTracklistToHtml(rawTracklist);

    await cosmic.objects.updateOne(id, {
      metadata: {
        tracklist: tracklist || null,
      },
    });

    revalidateEpisodeCaches(slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating episode tracklist:', error);
    const message =
      error instanceof Error && error.message ? error.message : 'Failed to update tracklist';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
