import { broadcastToISOString } from './date-utils';

interface CardRelation {
  id?: string;
  slug?: string;
  title?: string;
  name?: string;
}
const relations = (items: CardRelation[] = []) =>
  items.map(({ id, slug, title, name }) => ({ id, slug, title: title || name }));

/** Public card/player data only. Detail pages keep their full body and tracklist separately. */
export function toShowCardData(show: any) {
  const source = show.metadata || {};
  const image =
    source.external_image_url ||
    source.image?.imgix_url ||
    source.image?.url ||
    show.image ||
    '/image-placeholder.png';
  const player = source.player || show.player || show.url || '';
  const genres = relations(source.genres || show.genres || []);
  const hosts = relations(source.regular_hosts || show.regular_hosts || []);
  const locations = relations(source.locations || show.locations || []);
  const metadata = {
    external_image_url: image,
    image: { imgix_url: image, url: image },
    broadcast_date: source.broadcast_date || show.broadcast_date,
    broadcast_time: source.broadcast_time || show.broadcast_time,
    broadcast_date_old: source.broadcast_date_old,
    date: source.date,
    duration: source.duration || show.duration,
    player,
    genres,
    regular_hosts: hosts,
    locations,
    location: source.location
      ? { title: source.location.title || source.location.name }
      : undefined,
  };
  return {
    id: show.id,
    slug: show.slug,
    type: show.type,
    key: show.slug || show.key,
    title: show.title || show.name,
    name: show.title || show.name,
    url: player && !player.startsWith('http') ? `https://www.mixcloud.com${player}` : player,
    image,
    pictures: { large: image, medium: image },
    broadcast_date: metadata.broadcast_date,
    broadcast_time: metadata.broadcast_time,
    created_time:
      show.created_time ||
      broadcastToISOString(
        metadata.broadcast_date,
        metadata.broadcast_time,
        metadata.broadcast_date_old
      ) ||
      show.created_at,
    created_at: show.created_at,
    genres,
    regular_hosts: hosts,
    hosts,
    locations,
    host: show.host || hosts[0]?.title || '',
    user: { name: show.user?.name || show.host || hosts[0]?.title || '' },
    metadata,
  };
}
