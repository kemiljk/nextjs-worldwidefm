import { cosmic } from './cosmic-config';
import { unstable_cache } from 'next/cache';

export interface CanonicalGenre {
  id: string;
  slug: string;
  title: string;
}

async function fetchCanonicalGenres(): Promise<CanonicalGenre[]> {
  const res = await cosmic.objects
    .find({ type: 'genres' })
    .props('id,slug,title,metadata,type')
    .depth(1);
  return (res.objects || []).map((g: any) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
  }));
}

export async function getCanonicalGenres(): Promise<CanonicalGenre[]> {
  if (typeof window === 'undefined') {
    try {
      const getCachedGenres = unstable_cache(fetchCanonicalGenres, ['canonical-genres'], {
        tags: ['genres'],
        revalidate: 300,
      });
      return await getCachedGenres();
    } catch {
      return await fetchCanonicalGenres();
    }
  }
  return await fetchCanonicalGenres();
}
