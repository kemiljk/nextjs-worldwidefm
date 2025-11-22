import { Metadata } from 'next';
import { generateScheduleMetadata } from '@/lib/metadata-utils';
import { PageHeader } from '@/components/shared/page-header';
import ScheduleDisplay from '@/components/schedule-display';
import { cosmic } from '@/lib/cosmic-config';
import { EpisodeObject } from '@/lib/cosmic-types';
import { getEvents, RadioCultEvent } from '@/lib/radiocult-service';

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

interface ScheduleDay {
  day: string;
  episodes: EpisodeObject[];
}

interface ScheduleMetadata {
  days?: ScheduleDay[];
  [key: string]: any;
}

/**
 * Parse duration string (e.g., "60:00" or "1:30:00") to seconds
 */
function parseDurationToSeconds(duration: string | null | undefined): number {
  if (!duration) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Get WWFM playlist entries for all days of the week
 * Playlists are the same every day, so we fetch from any day and duplicate for all days
 */
async function getHardcodedPlaylists(): Promise<ScheduleShow[]> {
  try {
    // Fetch current week's events from RadioCult to identify playlists
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const { events } = await getEvents({
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      limit: 100,
    });

    // Get playlists from Monday (they're the same every day)
    const mondayPlaylists = events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getDay() === 1; // Monday
    });

    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hardcodedItems: ScheduleShow[] = [];

    // Add playlists for all days of the week
    for (const dayName of allDays) {
      for (const playlist of mondayPlaylists) {
        const eventDate = new Date(playlist.startTime);
        const hours = eventDate.getUTCHours().toString().padStart(2, '0');
        const minutes = eventDate.getUTCMinutes().toString().padStart(2, '0');
        const timeSlot = `${hours}:${minutes}`;

        hardcodedItems.push({
          show_key: playlist.slug,
          event_id: `playlist-${playlist.id}-${dayName}`,
          show_time: timeSlot,
          show_day: dayName,
          name: playlist.showName,
          url: `/shows/${playlist.slug}`,
          picture: playlist.imageUrl || '/image-placeholder.png',
          created_time: playlist.createdAt,
          tags: playlist.tags || [],
          hosts: playlist.artists?.map(artist => artist.name) || [],
          duration: playlist.duration * 60, // Convert minutes to seconds
          play_count: 0,
          favorite_count: 0,
          comment_count: 0,
          listener_count: 0,
          repost_count: 0,
        });
      }
    }

    console.log('[Schedule] Hardcoded playlists:', {
      totalPlaylists: mondayPlaylists.length,
      totalItems: hardcodedItems.length,
      itemsPerDay: hardcodedItems.length / 7,
    });

    return hardcodedItems;
  } catch (error) {
    console.error('[Schedule] Error fetching hardcoded playlists:', error);
    return [];
  }
}

/**
 * Fetch schedule from Cosmic Schedule object
 */
async function getWeeklySchedule(): Promise<{
  scheduleItems: ScheduleShow[];
  episodeSlugMap: Record<string, string>;
  isActive: boolean;
  error?: string;
}> {
  try {
    const scheduleResponse = await cosmic.objects
      .findOne({
        type: 'schedule',
        slug: 'this-week',
      })
      .props('slug,title,metadata,type')
      .depth(2);

    if (!scheduleResponse?.object) {
      console.log('[Schedule] No schedule object found');
      return {
        scheduleItems: [],
        episodeSlugMap: {},
        isActive: false,
        error: 'Schedule not found',
      };
    }

    const schedule = scheduleResponse.object;
    const metadata = schedule.metadata as any;

    console.log('[Schedule] Found schedule:', schedule.title);
    console.log('[Schedule] Metadata keys:', Object.keys(metadata || {}));

    const scheduleItems: ScheduleShow[] = [];
    const episodeSlugMap: Record<string, string> = {};

    // Get hardcoded playlists for all days
    const hardcodedPlaylists = await getHardcodedPlaylists();

    // Handle different possible structures
    // Option 1: metadata.days array
    if (Array.isArray(metadata.days)) {
      console.log('[Schedule] Using days array structure');
      for (const dayData of metadata.days) {
        const dayName = dayData.day || dayData.day_name || dayData.name;
        const episodes = dayData.episodes || dayData.shows || [];

        if (!dayName) {
          console.warn('[Schedule] Day data missing day name:', dayData);
          continue;
        }

        console.log(`[Schedule] Processing ${dayName}: ${episodes.length} episodes`);

        for (const episode of episodes) {
          if (!episode || episode.type !== 'episode') {
            continue;
          }

          const episodeMetadata = episode.metadata || {};
          const timeSlot = episodeMetadata.broadcast_time || '00:00';

          const scheduleItem: ScheduleShow = {
            show_key: episode.slug,
            event_id: `episode-${episode.id}`,
            show_time: timeSlot,
            show_day: dayName,
            name: episode.title,
            url: `/episode/${episode.slug}`,
            picture: episodeMetadata.image?.url
              ? `https://imgix.cosmicjs.com/${episodeMetadata.image.url}`
              : '/image-placeholder.png',
            created_time: episode.created_at,
            tags: episodeMetadata.genres?.map((g: any) => g.title) || [],
            hosts: episodeMetadata.regular_hosts?.map((h: any) => h.title) || [],
            duration: parseDurationToSeconds(episodeMetadata.duration),
            play_count: 0,
            favorite_count: 0,
            comment_count: 0,
            listener_count: 0,
            repost_count: 0,
          };

          scheduleItems.push(scheduleItem);
          episodeSlugMap[scheduleItem.event_id] = episode.slug;
        }
      }
    } else {
      // Option 2: Day names as keys in metadata (monday, tuesday, etc.)
      const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const dayNameMap: Record<string, string> = {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday',
      };

      console.log('[Schedule] Checking for day keys in metadata');
      for (const dayKey of dayKeys) {
        const dayEpisodes = metadata[dayKey] || metadata[dayKey.charAt(0).toUpperCase() + dayKey.slice(1)];
        const dayName = dayNameMap[dayKey];
        
        if (dayEpisodes && Array.isArray(dayEpisodes)) {
          console.log(`[Schedule] Processing ${dayName}: ${dayEpisodes.length} episodes`);

          for (const episode of dayEpisodes) {
            if (!episode || episode.type !== 'episode') {
              continue;
            }

            const episodeMetadata = episode.metadata || {};
            const timeSlot = episodeMetadata.broadcast_time || '00:00';

            const scheduleItem: ScheduleShow = {
              show_key: episode.slug,
              event_id: `episode-${episode.id}`,
              show_time: timeSlot,
              show_day: dayName,
              name: episode.title,
              url: `/episode/${episode.slug}`,
              picture: episodeMetadata.image?.url
                ? `https://imgix.cosmicjs.com/${episodeMetadata.image.url}`
                : '/image-placeholder.png',
              created_time: episode.created_at,
              tags: episodeMetadata.genres?.map((g: any) => g.title) || [],
              hosts: episodeMetadata.regular_hosts?.map((h: any) => h.title) || [],
              duration: parseDurationToSeconds(episodeMetadata.duration),
              play_count: 0,
              favorite_count: 0,
              comment_count: 0,
              listener_count: 0,
              repost_count: 0,
            };

            scheduleItems.push(scheduleItem);
            episodeSlugMap[scheduleItem.event_id] = episode.slug;
          }
        }
      }
    }

    // Add hardcoded playlists for all days
    scheduleItems.push(...hardcodedPlaylists);

    if (scheduleItems.length === 0) {
      console.warn('[Schedule] No episodes found. Metadata structure:', JSON.stringify(metadata, null, 2));
    }

    // Sort by day and time
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

    console.log('[Schedule] Final schedule items:', scheduleItems.length);
    console.log('[Schedule] Items by day:');
    const itemsByDay = scheduleItems.reduce((acc: Record<string, ScheduleShow[]>, item) => {
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
      scheduleItems,
      episodeSlugMap,
      isActive: scheduleItems.length > 0,
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
