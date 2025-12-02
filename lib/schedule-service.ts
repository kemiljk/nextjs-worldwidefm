import { cosmic, type GenreObject, type HostObject } from './cosmic-config';
import type { EpisodeObject } from './cosmic-types';
import { getCurrentUkWeek, type UkWeekday, type UkWeekInfo, UK_WEEK_DAYS } from './date-utils';
import type { ScheduleShow, ScheduleDayMap } from './types/schedule';

const TARGET_DAYS: UkWeekday[] = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PLACEHOLDER_IMAGE = '/image-placeholder.png';
export type { ScheduleShow };

export interface WeeklyScheduleResult {
  scheduleItems: ScheduleShow[];
  dayDates: ScheduleDayMap;
  isActive: boolean;
  error?: string;
}

const episodeCache = new Map<string, EpisodeObject>();

function parseDurationToSeconds(duration: string | null | undefined): number {
  if (!duration) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function isEpisodeObject(value: unknown): value is EpisodeObject {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      (value as { type?: string }).type === 'episode' &&
      'metadata' in value
  );
}

async function fetchEpisodeById(id: string): Promise<EpisodeObject | null> {
  if (episodeCache.has(id)) {
    return episodeCache.get(id) ?? null;
  }
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'episode',
        id,
      })
      .depth(2);
    const episode = (response?.object as EpisodeObject) || null;
    if (episode) {
      episodeCache.set(id, episode);
    }
    return episode;
  } catch (error) {
    console.warn(`[Schedule] Unable to fetch episode by ID ${id}`, error);
    return null;
  }
}

async function fetchEpisodeBySlug(slug: string): Promise<EpisodeObject | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'episode',
        slug,
        status: 'published',
      })
      .depth(2);
    return (response?.object as EpisodeObject) || null;
  } catch (error) {
    console.warn(`[Schedule] Unable to fetch episode by slug ${slug}`, error);
    return null;
  }
}

async function resolveEpisodeLink(link: unknown): Promise<EpisodeObject | null> {
  if (!link) return null;

  if (isEpisodeObject(link)) {
    return link;
  }

  if (typeof link === 'string') {
    return (await fetchEpisodeById(link)) ?? (await fetchEpisodeBySlug(link));
  }

  if (typeof link === 'object') {
    const linkObj = link as { id?: string; slug?: string };
    if (linkObj.id) {
      return fetchEpisodeById(linkObj.id);
    }
    if (linkObj.slug) {
      return fetchEpisodeBySlug(linkObj.slug);
    }
  }

  return null;
}

async function resolveEpisodeFromEntry(entry: any): Promise<EpisodeObject | null> {
  if (!entry) return null;

  if (isEpisodeObject(entry)) {
    return entry;
  }

  if (entry.episode) {
    return resolveEpisodeFromEntry(entry.episode);
  }

  if (entry.metadata?.episode_link) {
    return resolveEpisodeLink(entry.metadata.episode_link);
  }

  if (entry.episode_link) {
    return resolveEpisodeLink(entry.episode_link);
  }

  if (entry.id) {
    return fetchEpisodeById(entry.id);
  }

  if (entry.slug) {
    return fetchEpisodeBySlug(entry.slug);
  }

  if (typeof entry === 'string') {
    return resolveEpisodeLink(entry);
  }

  return null;
}

function buildScheduleShow(params: {
  episode: EpisodeObject | null;
  fallbackTitle: string;
  showDay: UkWeekday;
  date: string;
  time: string;
  isManual: boolean;
  overrideDuration?: string;
  urlOverride?: string;
}): ScheduleShow {
  const { episode, fallbackTitle, showDay, date, time, isManual, overrideDuration, urlOverride } = params;

  const title = fallbackTitle || episode?.title || 'Untitled';
  const slug = episode?.slug;
  const imageUrl =
    episode?.metadata?.image?.imgix_url ||
    episode?.metadata?.image?.url ||
    episode?.metadata?.image?.url ||
    PLACEHOLDER_IMAGE;

  const url =
    urlOverride ||
    (slug ? `/episode/${slug}` : episode?.metadata?.player || episode?.metadata?.source || '');

  const genres = (episode?.metadata?.genres || []) as GenreObject[];
  const hosts = (episode?.metadata?.regular_hosts || []) as HostObject[];

  const durationSource = overrideDuration || episode?.metadata?.duration || null;

  return {
    show_key: slug || `schedule-${title}-${date}-${time}`,
    event_id: episode ? `episode-${episode.id}` : `schedule-${date}-${time}-${title}`,
    show_time: time || '00:00',
    show_day: showDay,
    date,
    name: title,
    url: url || '',
    picture: imageUrl || PLACEHOLDER_IMAGE,
    created_time: episode?.created_at || new Date().toISOString(),
    tags: genres.map(genre => genre.title).filter(Boolean),
    hosts: hosts.map(host => host.title).filter(Boolean),
    duration: parseDurationToSeconds(durationSource),
    isManual,
  };
}

async function fetchManualOverrides(dayDates: Partial<ScheduleDayMap>): Promise<ScheduleShow[]> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'schedule',
        slug: 'this-week',
      })
      .props('metadata')
      .depth(3);

    const metadata = response?.object?.metadata as Record<string, unknown>;
    if (!metadata) {
      return [];
    }

    const overrides: ScheduleShow[] = [];

    for (const day of TARGET_DAYS) {
      const dayKey = day.toLowerCase();
      const scheduleBlock = metadata[dayKey];
      const showEntries: any[] | undefined =
        Array.isArray(scheduleBlock) ? scheduleBlock : (scheduleBlock as { show?: any[] })?.show;

      if (!Array.isArray(showEntries) || !dayDates[day]) {
        continue;
      }

      for (const entry of showEntries) {
        const episode = await resolveEpisodeFromEntry(entry);
        const overrideTime =
          entry?.broadcast_time_override ||
          entry?.override_broadcast_time ||
          entry?.metadata?.override_broadcast_time ||
          episode?.metadata?.broadcast_time ||
          '00:00';

        const overrideDuration =
          entry?.override_duration || entry?.metadata?.override_duration || undefined;

        const scheduleShow = buildScheduleShow({
          episode,
          fallbackTitle: entry?.title || entry?.name || episode?.title || 'Untitled',
          showDay: day,
          date: dayDates[day]!,
          time: overrideTime,
          isManual: true,
          overrideDuration,
          urlOverride: entry?.url,
        });

        overrides.push(scheduleShow);
      }
    }

    return overrides;
  } catch (error) {
    console.warn('[Schedule] Failed to fetch manual overrides', error);
    return [];
  }
}

async function fetchAutomaticEpisodes(dayDates: Partial<ScheduleDayMap>): Promise<ScheduleShow[]> {
  const targetDates = TARGET_DAYS.map(day => dayDates[day]).filter(Boolean) as string[];
  if (targetDates.length === 0) {
    console.log('[Schedule] No target dates for automatic episodes');
    return [];
  }

  try {
    console.log('[Schedule] Fetching automatic episodes for dates:', targetDates);
    
    const allEpisodes: EpisodeObject[] = [];
    
    for (const date of targetDates) {
      try {
        const response = await cosmic.objects
          .find({
            type: 'episode',
            status: 'published',
            'metadata.broadcast_date': date,
          })
          .props('id,slug,title,metadata,created_at')
          .limit(50)
          .sort('metadata.broadcast_time')
          .depth(2);

        const episodes = (response?.objects as EpisodeObject[] | undefined) || [];
        allEpisodes.push(...episodes);
      } catch (dateError: any) {
        // 404 means no episodes found for this date, which is fine
        if (dateError?.status === 404) {
          console.log(`[Schedule] No episodes found for date ${date}`);
        } else {
          console.warn(`[Schedule] Failed to fetch episodes for date ${date}:`, dateError);
        }
      }
    }

    console.log(`[Schedule] Found ${allEpisodes.length} automatic episodes total`);
    
    if (allEpisodes.length === 0) {
      return [];
    }

    const episodes = allEpisodes;

    return episodes
      .map(episode => {
        const broadcastDate = episode.metadata?.broadcast_date;
        if (!broadcastDate) {
          return null;
        }

        const showDay = new Date(broadcastDate + 'T00:00:00Z').toLocaleDateString('en-GB', {
          weekday: 'long',
          timeZone: 'Europe/London',
        }) as UkWeekday;

        if (!showDay || !TARGET_DAYS.includes(showDay)) {
          return null;
        }

        return buildScheduleShow({
          episode,
          fallbackTitle: episode.title,
          showDay,
          date: broadcastDate,
          time: episode.metadata?.broadcast_time || '00:00',
          isManual: false,
        });
      })
      .filter((item): item is ScheduleShow => Boolean(item));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Schedule] Failed to fetch automatic episodes', {
      error: errorMessage,
      stack: errorStack,
      targetDates,
    });
    return [];
  }
}

function sortScheduleItems(items: ScheduleShow[]): ScheduleShow[] {
  const dayOrder = new Map(UK_WEEK_DAYS.map((day, index) => [day, index]));

  return [...items].sort((a, b) => {
    const dayComparison =
      (dayOrder.get(a.show_day) ?? 0) - (dayOrder.get(b.show_day) ?? 0);
    if (dayComparison !== 0) {
      return dayComparison;
    }

    const [aHours, aMinutes] = a.show_time.split(':').map(Number);
    const [bHours, bMinutes] = b.show_time.split(':').map(Number);

    const aTotal = aHours * 60 + aMinutes;
    const bTotal = bHours * 60 + bMinutes;

    return aTotal - bTotal;
  });
}

export async function getWeeklySchedule(): Promise<WeeklyScheduleResult> {
  try {
    const { dayDates } = getCurrentUkWeek();
    const targetDayDates = TARGET_DAYS.reduce((acc, day) => {
      acc[day] = dayDates[day];
      return acc;
    }, {} as Partial<ScheduleDayMap>);

    const [manualOverrides, automaticEpisodes] = await Promise.all([
      fetchManualOverrides(targetDayDates),
      fetchAutomaticEpisodes(targetDayDates),
    ]);

    const dedupeMap = new Map<string, ScheduleShow>();
    for (const item of manualOverrides) {
      dedupeMap.set(item.event_id || item.show_key, item);
    }
    for (const item of automaticEpisodes) {
      const key = item.event_id || item.show_key;
      if (!dedupeMap.has(key)) {
        dedupeMap.set(key, item);
      }
    }

    const scheduleItems = sortScheduleItems(Array.from(dedupeMap.values()));

    return {
      scheduleItems,
      dayDates,
      isActive: scheduleItems.length > 0,
    };
  } catch (error) {
    console.error('[Schedule] Unexpected error generating schedule', error);
    return {
      scheduleItems: [],
      dayDates: getCurrentUkWeek().dayDates,
      isActive: false,
      error: error instanceof Error ? error.message : 'Failed to generate schedule.',
    };
  }
}

