import type { RadioShowObject } from './cosmic-config';
import type { EpisodeObject } from './cosmic-types';
import { broadcastToISOString } from './date-utils';

export function transformShowToViewData(show: RadioShowObject | EpisodeObject) {
  const metadata = show.metadata as Record<string, unknown> | undefined;
  const imageUrl =
    (metadata?.external_image_url as string) ||
    (show.metadata?.image?.imgix_url as string) ||
    '/image-placeholder.png';
  const transformed = {
    id: show.id,
    title: show.title,
    type: show.type,
    subtitle: show.metadata?.subtitle || '',
    description: show.metadata?.description || '',
    featured_on_homepage: show.metadata?.featured_on_homepage || false,
    image: imageUrl,
    thumbnail: imageUrl ? `${imageUrl}?w=100&h=100&fit=crop` : '/image-placeholder.png',
    slug: show.slug,
    broadcast_date: show.metadata?.broadcast_date || '',
    broadcast_time: show.metadata?.broadcast_time || '',
    broadcast_day: show.metadata?.broadcast_day || '',
    duration: show.metadata?.duration || '',
    player: show.metadata?.player || '',
    url: show.metadata?.player
      ? show.metadata.player.startsWith('http')
        ? show.metadata.player
        : `https://www.mixcloud.com${show.metadata.player}`
      : '',
    tracklist: show.metadata?.tracklist || '',
    body_text: show.metadata?.body_text || '',
    page_link: show.metadata?.page_link || '',
    source: show.metadata?.source || '',
    metadata: show.metadata || {},
    genres: (show.metadata?.genres || []).map(genre => ({
      id: genre.id,
      slug: genre.slug,
      title: genre.title,
      content: genre.content || '',
      type: genre.type,
      status: genre.status,
      metadata: genre.metadata || null,
      created_at: genre.created_at,
      modified_at: genre.modified_at,
      published_at: genre.published_at,
    })),
    tags: (show.metadata?.genres || []).map(genre => ({
      name: genre.title,
      title: genre.title,
    })),
    name: show.title,
    key: show.slug,
    created_time:
      broadcastToISOString(
        show.metadata?.broadcast_date,
        show.metadata?.broadcast_time,
        (metadata?.broadcast_date_old as string) || undefined
      ) || show.created_at,
    created_at: show.created_at,
    user: {
      name: show.metadata?.regular_hosts?.[0]?.title || '',
    },
    host: show.metadata?.regular_hosts?.[0]?.title || '',
    locations: (show.metadata?.locations || []).map(location => ({
      id: location.id,
      slug: location.slug,
      title: location.title,
      content: location.content || '',
      type: location.type,
      status: location.status,
      metadata: location.metadata || null,
      created_at: location.created_at,
      modified_at: location.modified_at,
      published_at: location.published_at,
    })),
    regular_hosts: (show.metadata?.regular_hosts || []).map(host => ({
      id: host.id,
      slug: host.slug,
      title: host.title,
      content: host.content || '',
      type: host.type,
      status: host.status,
      metadata: host.metadata || null,
      created_at: host.created_at,
      modified_at: host.modified_at,
      published_at: host.published_at,
    })),
    takeovers: (show.metadata?.takeovers || []).map(takeover => ({
      id: takeover.id,
      slug: takeover.slug,
      title: takeover.title,
      content: takeover.content || '',
      type: takeover.type,
      status: takeover.status,
      metadata: takeover.metadata || null,
      created_at: takeover.created_at,
      modified_at: takeover.modified_at,
      published_at: takeover.published_at,
    })),
  };
  return transformed;
}
