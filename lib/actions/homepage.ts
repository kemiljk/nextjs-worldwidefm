'use server';

import { getPublicObject, getPublicObjects } from '@/lib/cosmic-public';

import { CosmicHomepageData, HomepageSectionItem, ProcessedHomepageSection } from '../cosmic-types';

/**
 * Fetch for homepage data
 */
async function fetchHomepageFromCosmic(): Promise<CosmicHomepageData | null> {
  try {
    const response = await getPublicObject(
      {
        type: 'homepage',
        slug: 'homepage',
      },
      { props: 'slug,title,metadata,type', depth: 4 }
    );

    if (response?.object) {
      return response.object as CosmicHomepageData;
    }

    return null;
  } catch (error) {
    console.error('Error fetching homepage from Cosmic:', error);
    throw error;
  }
}

/**
 * Fallback fetch by ID
 */
async function fetchHomepageByIdFromCosmic(id: string): Promise<CosmicHomepageData | null> {
  try {
    const response = await getPublicObject({ id }, { props: 'slug,title,metadata,type', depth: 4 });

    return (response?.object as CosmicHomepageData) || null;
  } catch (error) {
    console.error('Error fetching homepage by ID:', error);
    throw error;
  }
}

export async function getCosmicHomepageData(): Promise<CosmicHomepageData | null> {
  // Try primary fetch
  const homepage = await fetchHomepageFromCosmic();
  if (homepage) {
    return homepage;
  }

  // Try fallback by ID
  const COSMIC_HOMEPAGE_ID = process.env.NEXT_PUBLIC_COSMIC_HOMEPAGE_ID;
  if (COSMIC_HOMEPAGE_ID && COSMIC_HOMEPAGE_ID !== 'undefined') {
    const fallback = await fetchHomepageByIdFromCosmic(COSMIC_HOMEPAGE_ID);
    if (fallback) {
      return fallback;
    }
  }

  console.error('Failed to fetch Cosmic homepage data: No homepage object found');
  return null;
}

/**
 * Fetch for Cosmic object by ID
 */
async function fetchObjectByIdFromCosmic(id: string): Promise<HomepageSectionItem | null> {
  try {
    const response = await getPublicObject({ id }, { props: 'slug,title,metadata,type', depth: 1 });

    return (response?.object as HomepageSectionItem) || null;
  } catch (error) {
    console.error('Error fetching Cosmic object by ID:', error, { id });
    throw error;
  }
}

export async function fetchCosmicObjectById(id: string): Promise<HomepageSectionItem | null> {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return null;
  }

  return fetchObjectByIdFromCosmic(id.trim());
}

export async function createColouredSections(
  colouredSections: ProcessedHomepageSection[]
): Promise<ProcessedHomepageSection[]> {
  const missingIds = [
    ...new Set(
      colouredSections.flatMap(section =>
        (section.items || [])
          .filter((item: any) => item.id && !item.metadata)
          .map((item: any) => item.id as string)
      )
    ),
  ];
  const objects = new Map<string, HomepageSectionItem>();
  for (let offset = 0; offset < missingIds.length; offset += 100) {
    const { objects: batch } = await getPublicObjects(
      { id: { $in: missingIds.slice(offset, offset + 100) } },
      {
        props: 'id,slug,title,metadata,type',
        depth: 1,
        limit: 100,
      }
    );
    for (const item of batch) objects.set(item.id, item);
  }
  return colouredSections.map(section => ({
    ...section,
    items: (section.items || []).map((item: any) => objects.get(item.id) || item),
  }));
}
