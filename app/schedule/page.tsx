import { Metadata } from 'next';
import { generateScheduleMetadata } from '@/lib/metadata-utils';
import { PageHeader } from '@/components/shared/page-header';
import ScheduleDisplay from '@/components/schedule-display';
import { cosmic } from '@/lib/cosmic-config';
import { EpisodeObject } from '@/lib/cosmic-types';

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

interface ScheduleEpisode {
  title: string;
  episode_link?: EpisodeObject | string;
  override_broadcast_date?: string;
  override_broadcast_time?: string;
  override_duration?: string;
}

interface ScheduleDay {
  day: string;
  episodes: ScheduleEpisode[];
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
      .depth(3);

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

    /**
     * Process a Schedule Episode object and create a ScheduleShow
     */
    async function processScheduleEpisode(
      scheduleEpisode: ScheduleEpisode,
      dayName: string
    ): Promise<ScheduleShow | null> {
      if (!scheduleEpisode.title) {
        console.warn('[Schedule] Schedule episode missing title');
        return null;
      }

      let episode: EpisodeObject | null = null;
      let episodeSlug: string | null = null;

      const scheduleEpisodeMetadata = (scheduleEpisode as any).metadata || {};
      const episodeLink = scheduleEpisodeMetadata.episode_link;

      if (episodeLink) {
        let episodeId: string | null = null;

        if (typeof episodeLink === 'string') {
          episodeId = episodeLink;
        } else if (episodeLink?.metadata) {
          episode = episodeLink as EpisodeObject;
          episodeSlug = episode.slug;
        } else if (episodeLink?.id) {
          episodeId = episodeLink.id;
        }

        if (episodeId && !episode) {
          try {
            const episodeResponse = await cosmic.objects.findOne({
              type: 'episode',
              id: episodeId,
            });
            if (episodeResponse?.object) {
              episode = episodeResponse.object as EpisodeObject;
              episodeSlug = episode.slug;
            } else {
              console.warn(`[Schedule] Episode not found by ID: ${episodeId}`);
            }
          } catch (error) {
            console.warn(`[Schedule] Could not fetch episode by ID: ${episodeId}`, error);
          }
        }
      }

      const episodeMetadata = (episode?.metadata || {}) as any;

      const broadcastTime =
        scheduleEpisodeMetadata.override_broadcast_time ||
        episodeMetadata.broadcast_time ||
        '00:00';
      const duration = scheduleEpisodeMetadata.override_duration || episodeMetadata.duration;
      const title = scheduleEpisode.title || episode?.title || 'Untitled';

      // Only create URL if we have an episode link
      const url = episodeSlug ? `/episode/${episodeSlug}` : '';

      const scheduleItem: ScheduleShow = {
        show_key: episodeSlug || `schedule-${title}`,
        event_id: episode ? `episode-${episode.id}` : `schedule-${title}-${dayName}`,
        show_time: broadcastTime,
        show_day: dayName,
        name: title,
        url,
        picture: episodeMetadata.image?.url
          ? `https://imgix.cosmicjs.com/${episodeMetadata.image.url}`
          : '/image-placeholder.png',
        created_time: episode?.created_at || new Date().toISOString(),
        tags: episodeMetadata.genres?.map((g: any) => g.title) || [],
        hosts: episodeMetadata.regular_hosts?.map((h: any) => h.title) || [],
        duration: parseDurationToSeconds(duration),
        play_count: 0,
        favorite_count: 0,
        comment_count: 0,
        listener_count: 0,
        repost_count: 0,
      };

      if (episodeSlug) {
        episodeSlugMap[scheduleItem.event_id] = episodeSlug;
      }

      return scheduleItem;
    }

    // Handle different possible structures
    // Option 1: metadata.days array
    if (Array.isArray(metadata.days)) {
      console.log('[Schedule] Using days array structure');
      for (const dayData of metadata.days) {
        const dayName = dayData.day || dayData.day_name || dayData.name;
        const scheduleEpisodes = dayData.episodes || dayData.shows || [];

        if (!dayName) {
          console.warn('[Schedule] Day data missing day name:', dayData);
          continue;
        }

        console.log(
          `[Schedule] Processing ${dayName}: ${scheduleEpisodes.length} schedule episodes`
        );

        for (const scheduleEpisode of scheduleEpisodes) {
          const scheduleItem = await processScheduleEpisode(scheduleEpisode, dayName);
          if (scheduleItem) {
            scheduleItems.push(scheduleItem);
          }
        }
      }
    } else {
      // Option 2: Day names as keys in metadata (monday, tuesday, etc.)
      const dayKeys = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
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
        const dayScheduleEpisodes =
          metadata[dayKey] || metadata[dayKey.charAt(0).toUpperCase() + dayKey.slice(1)];
        const dayName = dayNameMap[dayKey];

        if (dayScheduleEpisodes && Array.isArray(dayScheduleEpisodes)) {
          console.log(
            `[Schedule] Processing ${dayName}: ${dayScheduleEpisodes.length} schedule episodes`
          );

          for (const scheduleEpisode of dayScheduleEpisodes) {
            const scheduleItem = await processScheduleEpisode(scheduleEpisode, dayName);
            if (scheduleItem) {
              scheduleItems.push(scheduleItem);
            }
          }
        }
      }
    }

    if (scheduleItems.length === 0) {
      console.warn(
        '[Schedule] No episodes found. Metadata structure:',
        JSON.stringify(metadata, null, 2)
      );
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
