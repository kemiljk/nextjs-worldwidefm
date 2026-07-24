import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cosmic } from '@/lib/cosmic-config';

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

    const radiocultMediaId = body.radiocult_media_id as string | undefined;
    const player = body.player as string | null | undefined;
    const pageLink = body.page_link as string | null | undefined;
    const regularHosts = body.regular_hosts as string[] | undefined;
    const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : undefined;

    const updates: Record<string, unknown> = {};

    if (radiocultMediaId !== undefined) {
      updates.radiocult_media_id = radiocultMediaId;
    }
    if (player !== undefined) {
      updates.player = player;
    }
    if (pageLink !== undefined) {
      updates.page_link = pageLink;
    }
    if (regularHosts !== undefined) {
      if (
        !Array.isArray(regularHosts) ||
        !regularHosts.every(hostId => typeof hostId === 'string' && hostId.trim().length > 0)
      ) {
        return NextResponse.json({ error: 'regular_hosts must be an array of host IDs' }, { status: 400 });
      }
      updates.regular_hosts = Array.from(new Set(regularHosts.map(hostId => hostId.trim())));
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No archive fields to update' }, { status: 400 });
    }

    await cosmic.objects.updateOne(id, {
      metadata: updates,
    });

    revalidateEpisodeCaches(slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating episode archive:', error);
    const message =
      error instanceof Error && error.message ? error.message : 'Failed to update episode';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
