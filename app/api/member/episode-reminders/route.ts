import { NextResponse } from 'next/server';
import { getAuthUser, getUserData } from '@/cosmic/blocks/user-management/actions';
import { cosmic } from '@/lib/cosmic-config';
import { episodeStartTime, parseEpisodeReminderIds } from '@/lib/episode-reminders';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await getUserData(user.id);
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const ids = parseEpisodeReminderIds(data.metadata?.episode_reminders);
  if (!ids.length) return NextResponse.json({ userId: user.id, reminders: [] });

  try {
    const response = await cosmic.objects
      .find({ type: 'episode', id: { $in: ids } })
      .props(
        'id,slug,title,metadata.broadcast_date,metadata.broadcast_date_old,metadata.broadcast_time'
      )
      .status('published')
      .depth(0)
      .limit(100);
    const reminders = (response.objects || []).flatMap(
      (episode: {
        id: string;
        slug: string;
        title: string;
        metadata?: {
          broadcast_date?: string | null;
          broadcast_date_old?: string | null;
          broadcast_time?: string | null;
        };
      }) => {
        const start = episodeStartTime(episode.metadata || {});
        return start && start.getTime() > Date.now()
          ? [
              {
                id: episode.id,
                slug: episode.slug,
                title: episode.title,
                startsAt: start.toISOString(),
              },
            ]
          : [];
      }
    );
    return NextResponse.json(
      { userId: user.id, reminders },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if ((error as { status?: number })?.status === 404) {
      return NextResponse.json({ userId: user.id, reminders: [] });
    }
    console.error('Unable to load show reminders:', error);
    return NextResponse.json({ error: 'Unable to load reminders' }, { status: 503 });
  }
}
