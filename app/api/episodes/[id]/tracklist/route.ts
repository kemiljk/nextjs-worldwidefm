import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cosmic } from '@/lib/cosmic-config';

interface UpdateLiveShowBody {
  tracklist?: unknown;
  slug?: unknown;
  genreIds?: unknown;
  imageName?: unknown;
}

function plainTextTracklistToHtml(tracklist: string): string {
  return tracklist.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().replace(/\n/g, '<br />');
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
    const body = (await request.json()) as UpdateLiveShowBody;

    const rawTracklist = body.tracklist;
    if (typeof rawTracklist !== 'string') {
      return NextResponse.json({ error: 'tracklist must be a string' }, { status: 400 });
    }

    if (
      !Array.isArray(body.genreIds) ||
      !body.genreIds.every(genreId => typeof genreId === 'string' && genreId.trim())
    ) {
      return NextResponse.json({ error: 'genreIds must be an array of IDs' }, { status: 400 });
    }

    if (
      body.imageName !== undefined &&
      (typeof body.imageName !== 'string' || !body.imageName.trim())
    ) {
      return NextResponse.json({ error: 'imageName must be a non-empty string' }, { status: 400 });
    }

    const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : undefined;
    const tracklist = plainTextTracklistToHtml(rawTracklist);
    const imageName = typeof body.imageName === 'string' ? body.imageName.trim() : undefined;
    const metadata: Record<string, string | string[] | null> = {
      tracklist: tracklist || null,
      genres: body.genreIds,
    };

    if (imageName) {
      metadata.image = imageName;
      metadata.external_image_url = null;
    }

    await cosmic.objects.updateOne(id, {
      metadata,
      ...(imageName ? { thumbnail: imageName } : {}),
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
