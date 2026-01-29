import { cosmic, type GenreObject, type HostObject } from './cosmic-config';
import type { EpisodeObject } from './cosmic-types';
import { getCurrentUkWeek, type UkWeekday, UK_WEEK_DAYS } from './date-utils';
import type { ScheduleShow, ScheduleDayMap } from './types/schedule';

const TARGET_DAYS: UkWeekday[] = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PLACEHOLDER_IMAGE = '/image-placeholder.png';
const RERUN_SCHEDULE_ID = '69217f64b183692bb397e481';
export type { ScheduleShow };

export interface WeeklyScheduleResult {
  scheduleItems: ScheduleShow[];
  dayDates: ScheduleDayMap;
  isActive: boolean;
  error?: string;
}

const episodeCache = new Map<string, EpisodeObject>();

export function parseDurationToSeconds(duration: string | null | undefined): number {
  if (!duration) return 0;
  const trimmed = String(duration).trim();

  // If there is no colon, treat numeric-only values as hours (e.g. "4" => 4 hours)
  const isNumeric = !trimmed.includes(':') && !Number.isNaN(Number(trimmed));
  if (isNumeric) {
    const n = Number(trimmed);
    // Interpret reasonable hour values (<= 24) as hours, otherwise treat as minutes
    if (n <= 24) {
      return Math.round(n * 3600);
    }
    return Math.round(n * 60);
  }

  const parts = trimmed.split(':').map(Number);
  // Treat two-part values as hours:minutes (e.g. "04:00" => 4 hours)
  if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60;
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
  isReplay?: boolean;
  overrideDuration?: string;
  urlOverride?: string;
}): ScheduleShow {
  const { episode, fallbackTitle, showDay, date, time, isManual, isReplay, overrideDuration, urlOverride } =
    params;

  const title = fallbackTitle || episode?.title || 'Untitled';
  const slug = episode?.slug;
  const imageUrl =
    episode?.metadata?.external_image_url ||
    episode?.metadata?.image?.imgix_url ||
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
    isReplay,
  };
}

/**
 * Fetch for manual schedule overrides from all schedule objects
 */
async function fetchAllSchedules(): Promise<{ metadata: Record<string, unknown>; id: string }[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'schedule',
        // Optional: you could filter by slug: 'this-week' if you only want those,
        // but if the user provided a specific ID, we should ensure it's included.
      })
      .props('id,metadata')
      .depth(3);

    return (
      (response?.objects as { id: string; metadata: Record<string, unknown> }[]) || []
    ).map(obj => ({
      metadata: obj.metadata,
      id: obj.id,
    }));
  } catch (error) {
    console.warn('[Schedule] Failed to fetch schedule metadata', error);
    return [];
  }
}

async function fetchManualOverrides(dayDates: Partial<ScheduleDayMap>): Promise<ScheduleShow[]> {
  try {
    const schedules = await fetchAllSchedules();
    if (schedules.length === 0) {
      return [];
    }

    const overrides: ScheduleShow[] = [];

    for (const { metadata, id } of schedules) {
      const isReplay = id === RERUN_SCHEDULE_ID;

      for (const day of TARGET_DAYS) {
        const dayKey = day.toLowerCase();
        const scheduleBlock = metadata[dayKey];
        const showEntries: any[] | undefined = Array.isArray(scheduleBlock)
          ? scheduleBlock
          : (scheduleBlock as { show?: any[] })?.show;

        if (!Array.isArray(showEntries) || !dayDates[day]) {
          continue;
        }

        for (const entry of showEntries) {
          const typedEntry = entry as Record<string, unknown>;
          const episode = await resolveEpisodeFromEntry(typedEntry);
          const overrideTime =
            typedEntry?.broadcast_time_override ||
            typedEntry?.override_broadcast_time ||
            (typedEntry?.metadata as Record<string, unknown>)?.override_broadcast_time ||
            episode?.metadata?.broadcast_time ||
            '00:00';

          const overrideDuration =
            typedEntry?.override_duration ||
            (typedEntry?.metadata as Record<string, unknown>)?.override_duration ||
            undefined;

          const scheduleShow = buildScheduleShow({
            episode,
            fallbackTitle: (typedEntry?.title ||
              typedEntry?.name ||
              episode?.title ||
              'Untitled') as string,
            showDay: day,
            date: dayDates[day]!,
            time: overrideTime as string,
            isManual: true,
            isReplay,
            overrideDuration: overrideDuration as string | undefined,
            urlOverride: typedEntry?.url as string | undefined,
          });

          overrides.push(scheduleShow);
        }
      }
    }

    return overrides;
  } catch (error) {
    console.warn('[Schedule] Failed to fetch manual overrides', error);
    return [];
  }
}

/**
 * Fetch for episodes by date
 */
async function fetchEpisodesByDate(date: string): Promise<EpisodeObject[]> {
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

    return (response?.objects as EpisodeObject[] | undefined) || [];
  } catch (error: unknown) {
    const typedError = error as { status?: number };
    if (typedError?.status === 404) {
      return [];
    }
    console.warn(`[Schedule] Failed to fetch episodes for date ${date}:`, error);
    return [];
  }
}

async function fetchAutomaticEpisodes(dayDates: Partial<ScheduleDayMap>): Promise<ScheduleShow[]> {
  const targetDates = TARGET_DAYS.map(day => dayDates[day]).filter(Boolean) as string[];
  if (targetDates.length === 0) {
    return [];
  }

  try {
    console.log('[Schedule] Fetching automatic episodes for dates:', targetDates);

    // Fetch episodes for all dates in parallel (each call is cached)
    const episodeArrays = await Promise.all(targetDates.map(date => fetchEpisodesByDate(date)));

    const allEpisodes = episodeArrays.flat();

    console.log(`[Schedule] Found ${allEpisodes.length} automatic episodes total`);

    if (allEpisodes.length === 0) {
      return [];
    }

    return allEpisodes
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
    console.error('[Schedule] Failed to fetch automatic episodes', {
      error: errorMessage,
      targetDates,
    });
    return [];
  }
}

function sortScheduleItems(items: ScheduleShow[]): ScheduleShow[] {
  const dayOrder = new Map(UK_WEEK_DAYS.map((day, index) => [day, index]));

  return [...items].sort((a, b) => {
    const dayComparison = (dayOrder.get(a.show_day) ?? 0) - (dayOrder.get(b.show_day) ?? 0);
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
      if (item.name !== 'Untitled') {
        dedupeMap.set(item.event_id || item.show_key, item);
      }
    }
    for (const item of automaticEpisodes) {
      if (item.name !== 'Untitled') {
        const key = item.event_id || item.show_key;
        if (!dedupeMap.has(key)) {
          dedupeMap.set(key, item);
        }
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
