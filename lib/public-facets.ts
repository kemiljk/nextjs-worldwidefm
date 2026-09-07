import 'server-only';
import { getPublicObjects } from './cosmic-public';
import { deduplicateFilters, type FilterItem } from './filter-types';

type FacetType =
  | 'genres'
  | 'regular-hosts'
  | 'locations'
  | 'takeovers'
  | 'featured-shows'
  | 'series';

export interface PublicFacet extends FilterItem {
  type: string;
}

/** One lean, shared dataset per taxonomy; do not cache outages as empty filters. */
export async function getPublicFacet(type: FacetType): Promise<PublicFacet[]> {
  const items: PublicFacet[] = [];
  const limit = 1000;
  for (let skip = 0; ; skip += limit) {
    const response = await getPublicObjects(
      { type },
      { props: 'id,slug,title', depth: 0, limit, ...(skip ? { skip } : {}) }
    );
    items.push(
      ...response.objects.map((item: FilterItem) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        type: type === 'regular-hosts' ? 'hosts' : type,
      }))
    );
    if (response.objects.length < limit || items.length >= response.total) break;
  }
  return deduplicateFilters(items);
}

export async function getSearchFacets() {
  const [genres, hosts, locations] = await Promise.all([
    getPublicFacet('genres'),
    getPublicFacet('regular-hosts'),
    getPublicFacet('locations'),
  ]);
  const compact = (items: PublicFacet[]) => items.map(({ id, title }) => ({ id, title }));
  return { genres: compact(genres), hosts: compact(hosts), locations: compact(locations) };
}
