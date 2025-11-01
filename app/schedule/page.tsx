import { Metadata } from 'next';
import { getEvents } from '@/lib/radiocult-service';
import { generateScheduleMetadata } from '@/lib/metadata-utils';
import { PageHeader } from '@/components/shared/page-header';
import ScheduleDisplay from '@/components/schedule-display';
import { cosmic } from '@/lib/cosmic-config';
import { parseBroadcastDateTime } from '@/lib/date-utils';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateScheduleMetadata();
};

export const revalidate = 60; // 1 minute

interface ScheduleShow {
  show_key: string;
  event_id: string;
  show_time: string;
  show_day: string;
  name: string;
  url: string;
  picture: string;
  created_time: string;
  tags: string[];
  hosts: string[];
  duration: number;
  play_count: number;
  favorite_count: number;
  comment_count: number;
  listener_count: number;
  repost_count: number;
}

/**
 * Get the start of the current week (Monday) and end of the week (Sunday)
 */
function getWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday as -6

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + daysToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/**
 * Fetch data from Cosmic and RadioCult, merge them, and create a weekly schedule
 */
async function getWeeklySchedule(): Promise<{
  scheduleItems: ScheduleShow[];
  episodeSlugMap: Record<string, string>;
  isActive: boolean;
  error?: string;
}> {
  try {
    const { weekStart, weekEnd } = getWeekBounds();
    console.log('[Schedule] Week bounds:', {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    });

    // 1. Get all published episodes from Cosmic for this week
    const cosmicEpisodesResponse = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
        $or: [
          { 'metadata.broadcast_date': { $gte: weekStart.toISOString().split('T')[0] } },
          { 'metadata.broadcast_date_old': { $gte: weekStart.toISOString() } },
        ],
      })
      .props('id,slug,title,metadata')
      .limit(200);

    const cosmicEpisodes = cosmicEpisodesResponse.objects || [];
    console.log('[Schedule] Found Cosmic episodes:', cosmicEpisodes.length);

    // 2. Get RadioCult events for this week
    const { events: radiocultEvents = [] } = await getEvents({
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      limit: 100,
    });

    console.log('[Schedule] Found RadioCult events:', radiocultEvents.length);

    // 3. Create a map of RadioCult events by their event ID
    const radiocultEventMap = new Map(radiocultEvents.map(event => [event.id, event]));

    // 4. Process Cosmic episodes and merge with RadioCult data
    const scheduleItems: ScheduleShow[] = [];
    const episodeSlugMap: Record<string, string> = {};

    for (const episode of cosmicEpisodes) {
      const metadata = episode.metadata;
      const broadcastDate = parseBroadcastDateTime(
        metadata.broadcast_date,
        metadata.broadcast_time,
        metadata.broadcast_date_old
      );

      if (!broadcastDate) {
        console.log(`[Schedule] Skipping episode ${episode.title} - no valid broadcast date`);
        continue;
      }

      // Check if this episode is within our week bounds
      if (broadcastDate < weekStart || broadcastDate > weekEnd) {
        continue;
      }

      const dayName = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ][broadcastDate.getDay()];

      const hours = broadcastDate.getHours().toString().padStart(2, '0');
      const minutes = broadcastDate.getMinutes().toString().padStart(2, '0');
      const timeSlot = `${hours}:${minutes}`;

      // Check if there's a corresponding RadioCult event
      const radiocultEvent = metadata.radiocult_event_id
        ? radiocultEventMap.get(metadata.radiocult_event_id)
        : null;

      // Create schedule item, preferring RadioCult data when available
      const scheduleItem: ScheduleShow = {
        show_key: episode.slug,
        event_id: radiocultEvent?.id || `cosmic-${episode.id}`,
        show_time: timeSlot,
        show_day: dayName,
        name: radiocultEvent?.showName || episode.title,
        url: `/episode/${episode.slug}`, // Always link to episode page
        picture:
          radiocultEvent?.imageUrl ||
          (metadata.image?.url
            ? `https://imgix.cosmicjs.com/${metadata.image.url}`
            : '/image-placeholder.png'),
        created_time: episode.created_at,
        tags: radiocultEvent?.tags || metadata.genres?.map((g: any) => g.title) || [],
        hosts:
          radiocultEvent?.artists?.map(artist => artist.name) ||
          metadata.regular_hosts?.map((h: any) => h.title) ||
          [],
        duration:
          radiocultEvent?.duration ||
          (metadata.duration ? parseDurationToMinutes(metadata.duration) * 60 : 0),
        play_count: 0,
        favorite_count: 0,
        comment_count: 0,
        listener_count: 0,
        repost_count: 0,
      };

      scheduleItems.push(scheduleItem);
      episodeSlugMap[scheduleItem.event_id] = episode.slug;
    }

    // 5. Add any RadioCult events that don't have corresponding Cosmic episodes
    for (const event of radiocultEvents) {
      const hasCosmicEpisode = Object.values(episodeSlugMap).some(slug =>
        scheduleItems.some(item => item.event_id === event.id)
      );

      if (!hasCosmicEpisode) {
        const eventDate = new Date(event.startTime);
        const dayName = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ][eventDate.getDay()];

        const hours = eventDate.getHours().toString().padStart(2, '0');
        const minutes = eventDate.getMinutes().toString().padStart(2, '0');
        const timeSlot = `${hours}:${minutes}`;

        const scheduleItem: ScheduleShow = {
          show_key: event.slug,
          event_id: event.id,
          show_time: timeSlot,
          show_day: dayName,
          name: event.showName,
          url: `/shows/${event.slug}`, // Fallback to show page
          picture: event.imageUrl || '/image-placeholder.png',
          created_time: event.createdAt,
          tags: event.tags || [],
          hosts: event.artists?.map(artist => artist.name) || [],
          duration: event.duration || 0,
          play_count: 0,
          favorite_count: 0,
          comment_count: 0,
          listener_count: 0,
          repost_count: 0,
        };

        scheduleItems.push(scheduleItem);
      }
    }

    // 6. Sort by day and time, ensuring no overlaps
    scheduleItems.sort((a, b) => {
      const dayOrder = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];
      const dayA = dayOrder.indexOf(a.show_day);
      const dayB = dayOrder.indexOf(b.show_day);

      if (dayA !== dayB) return dayA - dayB;

      const timeA = a.show_time.split(':').map(Number);
      const timeB = b.show_time.split(':').map(Number);
      return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
    });

    // 7. Remove overlapping shows (same day and time)
    const deduplicatedItems: ScheduleShow[] = [];
    const timeSlotMap = new Map<string, ScheduleShow>();

    for (const item of scheduleItems) {
      const key = `${item.show_day}-${item.show_time}`;

      if (!timeSlotMap.has(key)) {
        timeSlotMap.set(key, item);
        deduplicatedItems.push(item);
      } else {
        // Keep the one with more complete data (prefer Cosmic episodes)
        const existing = timeSlotMap.get(key)!;
        if (item.url.startsWith('/episode/') && !existing.url.startsWith('/episode/')) {
          timeSlotMap.set(key, item);
          const index = deduplicatedItems.findIndex(i => i === existing);
          if (index !== -1) {
            deduplicatedItems[index] = item;
          }
        }
      }
    }

    console.log('[Schedule] Final schedule items:', deduplicatedItems.length);
    console.log('[Schedule] Items by day:');
    const itemsByDay = deduplicatedItems.reduce((acc: Record<string, ScheduleShow[]>, item) => {
      if (!acc[item.show_day]) acc[item.show_day] = [];
      acc[item.show_day].push(item);
      return acc;
    }, {});

    Object.entries(itemsByDay).forEach(([day, items]) => {
      console.log(`  ${day}: ${items.length} shows`);
      items.forEach(item => {
        console.log(`    ${item.show_time} - ${item.name}`);
      });
    });

    return {
      scheduleItems: deduplicatedItems,
      episodeSlugMap,
      isActive: deduplicatedItems.length > 0,
    };
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return {
      scheduleItems: [],
      episodeSlugMap: {},
      isActive: false,
      error:
        error instanceof Error ? error.message : 'An error occurred while fetching the schedule',
    };
  }
}

/**
 * Parse duration string (e.g., "60:00" or "1:30:00") to minutes
 */
function parseDurationToMinutes(duration: string): number {
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 60 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export default async function SchedulePage() {
  const { scheduleItems, episodeSlugMap, isActive, error } = await getWeeklySchedule();

  return (
    <div className='min-h-screen bg-white pb-40 dark:bg-black'>
      <div className=''>
        <div className='relative w-full pt-10 overflow-hidden'>
          <div className='relative left-0 w-full px-5 z-1 '>
            <PageHeader title='schedule' />
          </div>
        </div>
        <ScheduleDisplay
          scheduleItems={scheduleItems}
          episodeSlugMap={episodeSlugMap}
          isActive={isActive}
          error={error}
        />
      </div>
    </div>
  );
}
