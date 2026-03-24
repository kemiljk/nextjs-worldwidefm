import { NextResponse } from 'next/server';
import { cosmic } from '@/lib/cosmic-config';
import { getScheduleData } from '@/lib/radiocult-service';
import { extractDatePart } from '@/lib/date-utils';
import type { EpisodeObject } from '@/lib/cosmic-types';

interface RequestBody {
  title?: string;
  startTime?: string;
  broadcastDate?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveBroadcastDate(
  title: string,
  providedDate?: string,
  providedStartTime?: string
): Promise<string | null> {
  if (providedDate) return providedDate;
  if (providedStartTime) {
    const extracted = extractDatePart(providedStartTime);
    if (extracted) return extracted;
  }

  try {
    const scheduleData = await getScheduleData();
    const normalizedTitle = title.trim().toLowerCase();
    const events = [
      scheduleData.currentEvent,
      scheduleData.upcomingEvent,
      ...scheduleData.upcomingEvents,
    ].filter(Boolean);

    const match = events.find(event => event?.showName?.trim().toLowerCase() === normalizedTitle);

    if (match?.startTime) {
      return extractDatePart(match.startTime);
    }
  } catch (error) {
    console.warn('[live-link] Failed to resolve broadcast date via schedule', error);
  }

  return null;
}

function buildQuery(title: string, broadcastDate: string | null): Record<string, unknown> {
  const query: Record<string, unknown> = {
    type: 'episode',
    status: 'published',
  };

  if (broadcastDate) {
    query['metadata.broadcast_date'] = broadcastDate;
  } else {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    query['metadata.broadcast_date'] = {
      $gte: sevenDaysAgo.toISOString().slice(0, 10),
      $lte: today.toISOString().slice(0, 10),
    };
  }

  query.title = { $regex: `^${escapeRegex(title.trim())}$`, $options: 'i' };

  return query;
}

async function findEpisode(query: Record<string, unknown>): Promise<EpisodeObject | null> {
  const response = await cosmic.objects
    .find(query)
    .limit(5)
    .sort('-metadata.broadcast_date')
    .depth(2);
  const episodes = (response.objects as EpisodeObject[]) || [];
  if (episodes.length > 0) {
    return episodes[0];
  }

  // Relax the title match to partial if no exact matches
  if (query.title && typeof query.title === 'object') {
    const partialQuery = {
      ...query,
      title: {
        $regex: escapeRegex((query.title as { $regex: string }).$regex.replace(/^\^|\$$/g, '')),
        $options: 'i',
      },
    };
    const fallbackResponse = await cosmic.objects
      .find(partialQuery)
      .limit(5)
      .sort('-metadata.broadcast_date')
      .depth(2);
    const fallbackEpisodes = (fallbackResponse.objects as EpisodeObject[]) || [];
    return fallbackEpisodes[0] || null;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const title = body?.title?.trim();

    if (!title) {
      return NextResponse.json({ error: 'Show title is required.' }, { status: 400 });
    }

    const broadcastDate = await resolveBroadcastDate(title, body.broadcastDate, body.startTime);

    const episode = await findEpisode(buildQuery(title, broadcastDate));

    if (!episode) {
      return NextResponse.json({ error: 'Matching episode not found.' }, { status: 404 });
    }

    return NextResponse.json({
      slug: episode.slug,
      title: episode.title,
      broadcast_date: episode.metadata?.broadcast_date || null,
    });
  } catch (error) {
    console.error('[live-link] Error resolving episode link', error);
    return NextResponse.json({ error: 'Unable to resolve episode link.' }, { status: 500 });
  }
}
