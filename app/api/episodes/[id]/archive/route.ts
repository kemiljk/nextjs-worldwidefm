import { NextRequest, NextResponse } from 'next/server';
import { cosmic } from '@/lib/cosmic-config';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const radiocultMediaId = body.radiocult_media_id as string | undefined;
    const player = body.player as string | null | undefined;
    const pageLink = body.page_link as string | null | undefined;

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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No archive fields to update' }, { status: 400 });
    }

    const existing = await cosmic.objects.findOne({
      type: 'episode',
      id,
    });

    if (!existing?.object) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const currentMeta = (existing.object as { metadata?: Record<string, unknown> }).metadata || {};
    const mergedMetadata = {
      ...currentMeta,
      ...updates,
    };

    await cosmic.objects.updateOne(id, {
      metadata: mergedMetadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating episode archive:', error);
    return NextResponse.json(
      { error: 'Failed to update episode' },
      { status: 500 }
    );
  }
}
