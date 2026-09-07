import { getPublicFacet } from './public-facets';

export interface CanonicalGenre {
  id: string;
  slug: string;
  title: string;
}

export async function getCanonicalGenres(): Promise<CanonicalGenre[]> {
  return getPublicFacet('genres');
}
