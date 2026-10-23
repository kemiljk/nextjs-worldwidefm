import { cosmic } from '@/lib/cosmic-config';
import { getCurrentUkWeek } from '@/lib/date-utils';
import {
  buildRecurringEpisodeSlug,
  RECURRING_SHOWS,
  getRecurringEpisodeBody,
  type RecurringShowTemplate,
} from '@/lib/recurring-shows';

export interface CreateWeeklyShowsResult {
  success: boolean;
  weekStarting: string;
  created: string[];
  skipped: string[];
  warnings: { title: string; broadcastDate: string; message: string }[];
  errors: { title: string; broadcastDate: string; error: string }[];
}

function formatCosmicError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (typeof record.error === 'string') {
      return record.error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

async function findExistingEpisode(title: string, broadcastDate: string): Promise<boolean> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'episode',
        title,
        'metadata.broadcast_date': broadcastDate,
      })
      .props('id')
      .limit(1)
      .status('any');

    return Boolean(response.objects && response.objects.length > 0);
  } catch (error) {
    const typedError = error as { status?: number };
    if (typedError?.status === 404) {
      return false;
    }
    throw error;
  }
}

async function findHostBySlug(slug: string): Promise<{
  id: string;
  metadata?: {
    description?: string | null;
    image?: { url?: string | null; imgix_url?: string | null } | null;
    external_image_url?: string | null;
  } | null;
} | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'regular-hosts',
        slug,
      })
      .props('id,metadata.description,metadata.image,metadata.external_image_url')
      .status('any');

    return response?.object ?? null;
  } catch (error) {
    const typedError = error as { status?: number };
    if (typedError?.status === 404) {
      return null;
    }
    throw error;
  }
}

type SiblingTaxonomy = { type?: string; locations?: string[]; genres?: string[] };

function relationIds(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items
    .map(item => (typeof item === 'string' ? item : (item as { id?: string })?.id))
    .filter((id): id is string => Boolean(id));
}

/**
 * Show category, locations and genres from the host's latest published episode,
 * so new weekly pages don't need them added by hand.
 */
export async function findHostTaxonomy(
  hostId: string,
  client: Pick<typeof cosmic, 'objects'> = cosmic
): Promise<SiblingTaxonomy> {
  try {
    const response = await client.objects
      .find({ type: 'episode', 'metadata.regular_hosts': hostId })
      .props('id,metadata.type,metadata.locations,metadata.genres')
      .sort('-metadata.broadcast_date')
      .depth(0)
      .limit(1)
      .status('published');

    const metadata = response.objects?.[0]?.metadata as Record<string, unknown> | undefined;
    if (!metadata) return {};

    const [type] = relationIds(metadata.type);
    const locations = relationIds(metadata.locations);
    const genres = relationIds(metadata.genres);
    return {
      ...(type ? { type } : {}),
      ...(locations.length ? { locations } : {}),
      ...(genres.length ? { genres } : {}),
    };
  } catch (error) {
    if ((error as { status?: number })?.status === 404) return {};
    throw error;
  }
}

async function createRecurringEpisode(params: {
  template: RecurringShowTemplate;
  broadcastDate: string;
  host: Awaited<ReturnType<typeof findHostBySlug>>;
}): Promise<void> {
  const { template, broadcastDate, host } = params;
  const broadcastDay = new Date(`${broadcastDate}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'Europe/London',
  });

  // Copy goes in the main text field. No image is written: the site shows the
  // host's image until staff upload one, so an upload is never overridden.
  const metadata: Record<string, unknown> = {
    broadcast_date: broadcastDate,
    broadcast_time: template.startTime,
    broadcast_day: broadcastDay,
    duration: `${template.durationHours}:00`,
    body_text: getRecurringEpisodeBody(template, host?.metadata),
    is_live: true,
    source: 'recurring-auto',
  };

  if (host) {
    metadata.regular_hosts = [host.id];
    Object.assign(metadata, await findHostTaxonomy(host.id));
  }

  const objectData = {
    type: 'episode',
    title: template.title,
    slug: buildRecurringEpisodeSlug(template.title, broadcastDate),
    status: 'draft',
    metadata,
  };

  try {
    await cosmic.objects.insertOne(objectData);
  } catch (error) {
    const message = formatCosmicError(error);
    const match = message.match(/metafield with key: '([^']+)' is missing/i);

    if (match?.[1]) {
      const stripped = { ...metadata };
      delete stripped[match[1]];
      await cosmic.objects.insertOne({
        ...objectData,
        metadata: stripped,
      });
      return;
    }

    throw new Error(message);
  }
}

export async function createWeeklyRecurringShows(
  referenceDate: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
): Promise<CreateWeeklyShowsResult> {
  const { dayDates } = getCurrentUkWeek(referenceDate);

  const result: CreateWeeklyShowsResult = {
    success: true,
    weekStarting: dayDates.Monday,
    created: [],
    skipped: [],
    warnings: [],
    errors: [],
  };

  for (const template of RECURRING_SHOWS) {
    const broadcastDate = dayDates[template.day];

    if (!broadcastDate) {
      result.errors.push({
        title: template.title,
        broadcastDate: template.day,
        error: `No date found for ${template.day}`,
      });
      continue;
    }

    try {
      const exists = await findExistingEpisode(template.title, broadcastDate);
      if (exists) {
        result.skipped.push(`${template.title} (${broadcastDate})`);
        continue;
      }

      let host: Awaited<ReturnType<typeof findHostBySlug>> = null;
      if (template.hostSlug) {
        host = await findHostBySlug(template.hostSlug);
        if (!host) {
          result.warnings.push({
            title: template.title,
            broadcastDate,
            message: `Host not found for slug "${template.hostSlug}" — episode created without host link`,
          });
        }
      }

      await createRecurringEpisode({
        template,
        broadcastDate,
        host,
      });

      result.created.push(`${template.title} (${broadcastDate})`);
    } catch (error) {
      result.errors.push({
        title: template.title,
        broadcastDate,
        error: formatCosmicError(error),
      });
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
