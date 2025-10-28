import { Metadata } from 'next';
import { getEvents } from '@/lib/radiocult-service';
import { generateScheduleMetadata } from '@/lib/metadata-utils';
import { PageHeader } from '@/components/shared/page-header';
import ScheduleDisplay from '@/components/schedule-display';
import { cosmic } from '@/lib/cosmic-config';

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
 * Fetch data from RadioCult and transform it into a weekly schedule
 */
async function getWeeklySchedule(): Promise<{
  scheduleItems: ScheduleShow[];
  episodeSlugMap: Record<string, string>;
  isActive: boolean;
  error?: string;
}> {
  try {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    const { events = [] } = await getEvents({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 100,
    });

    const maxDate = new Date(now);
    maxDate.setDate(now.getDate() + 7);

    const filteredEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate <= maxDate;
    });

    console.log('[Schedule] Total events from RadioCult:', events.length);
    console.log('[Schedule] After filtering to 7 days:', filteredEvents.length);

    if (filteredEvents.length > 0) {
      console.log('[Schedule] Filtered events:');
      filteredEvents.forEach((event, idx) => {
        const eventDate = new Date(event.startTime);
        const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][eventDate.getDay()];
        const dateStr = eventDate.toISOString().split('T')[0];
        console.log(
          `  ${idx + 1}. [${day} ${dateStr}] ${event.showName} | Start: ${event.startTime}`
        );
      });
    }

    if (!filteredEvents || filteredEvents.length === 0) {
      return {
        scheduleItems: [],
        episodeSlugMap: {},
        isActive: false,
        error: 'No schedule available at this time',
      };
    }

    const eventIds = filteredEvents.map(event => event.id).filter(Boolean);

    let episodeSlugMap: Record<string, string> = {};

    if (eventIds.length > 0) {
      try {
        const episodesResponse = await cosmic.objects
          .find({
            type: 'episode',
            status: 'published',
            'metadata.radiocult_event_id': { $in: eventIds },
          })
          .props('slug,metadata')
          .limit(100);

        const episodes = episodesResponse.objects || [];
        episodeSlugMap = episodes.reduce((acc: Record<string, string>, episode: any) => {
          const eventId = episode.metadata?.radiocult_event_id;
          if (eventId && episode.slug) {
            acc[eventId] = episode.slug;
          }
          return acc;
        }, {});
      } catch (error) {
        console.error('Error fetching episodes for schedule:', error);
      }
    }

    const eventsByDayAndTime = new Map<string, (typeof filteredEvents)[0]>();

    filteredEvents.forEach(event => {
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
      const key = `${dayName}-${timeSlot}`;

      if (!eventsByDayAndTime.has(key)) {
        eventsByDayAndTime.set(key, event);
      } else {
        const existing = eventsByDayAndTime.get(key)!;
        const existingDate = new Date(existing.startTime);
        const currentDate = new Date(event.startTime);

        if (currentDate < existingDate) {
          console.log(
            `[Schedule] Replacing ${dayName} ${timeSlot}: "${existing.showName}" (${existing.startTime}) with "${event.showName}" (${event.startTime})`
          );
          eventsByDayAndTime.set(key, event);
        } else {
          console.log(
            `[Schedule] Skipping duplicate ${dayName} ${timeSlot}: "${event.showName}" (${event.startTime}) - keeping earlier event "${existing.showName}" (${existing.startTime})`
          );
        }
      }
    });

    const uniqueEvents = Array.from(eventsByDayAndTime.values());
    console.log('[Schedule] After deduplication by day+time:', uniqueEvents.length);

    const scheduleItems = uniqueEvents.map(event => {
      const eventDate = new Date(event.startTime);
      const hours = eventDate.getHours().toString().padStart(2, '0');
      const minutes = eventDate.getMinutes().toString().padStart(2, '0');

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[eventDate.getDay()];

      return {
        show_key: event.slug,
        event_id: event.id,
        show_time: `${hours}:${minutes}`,
        show_day: dayName,
        name: event.showName,
        url: `/shows/${event.slug}`,
        picture: event.imageUrl || '/image-placeholder.png',
        created_time: event.createdAt,
        tags: event.tags || [],
        hosts: (event.artists || []).map(artist => artist.name || 'Unknown Artist'),
        duration: event.duration || 0,
        play_count: 0,
        favorite_count: 0,
        comment_count: 0,
        listener_count: 0,
        repost_count: 0,
      };
    });

    console.log('[Schedule] Final schedule items grouped by day:');
    const itemsByDay = scheduleItems.reduce((acc: Record<string, any[]>, item) => {
      if (!acc[item.show_day]) acc[item.show_day] = [];
      acc[item.show_day].push(item);
      return acc;
    }, {});

    Object.entries(itemsByDay).forEach(([day, items]) => {
      console.log(`  ${day}:`);
      items.forEach((item: any) => {
        console.log(`    ${item.show_time} - ${item.name} (Event ID: ${item.event_id})`);
      });
    });

    return {
      scheduleItems,
      episodeSlugMap,
      isActive: scheduleItems.length > 0,
    };
  } catch (error) {
    console.error('Error fetching RadioCult schedule:', error);
    return {
      scheduleItems: [],
      episodeSlugMap: {},
      isActive: false,
      error:
        error instanceof Error ? error.message : 'An error occurred while fetching the schedule',
    };
  }
}

export default async function SchedulePage() {
  const { scheduleItems, episodeSlugMap, isActive, error } = await getWeeklySchedule();

  return (
    <div className='min-h-screen bg-white dark:bg-black'>
      <div className=''>
        <div className='relative w-full pt-20 overflow-hidden'>
          <div className='relative left-0 w-full px-5 z-10'>
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
