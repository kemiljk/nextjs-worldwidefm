'use server';

import { CosmicHomepageData, HomepageSectionItem, ProcessedHomepageSection } from '../cosmic-types';
import { cosmic } from '../cosmic-config';

/**
 * Fetch for homepage data
 */
async function fetchHomepageFromCosmic(): Promise<CosmicHomepageData | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'homepage',
        slug: 'homepage',
      })
      .props('slug,title,metadata,type')
      .depth(4);

    if (response?.object) {
      return response.object as CosmicHomepageData;
    }

    return null;
  } catch (error) {
    console.error('Error fetching homepage from Cosmic:', error);
    return null;
  }
}

/**
 * Fallback fetch by ID
 */
async function fetchHomepageByIdFromCosmic(id: string): Promise<CosmicHomepageData | null> {
  try {
    const response = await cosmic.objects
      .findOne({ id })
      .props('slug,title,metadata,type')
      .depth(4);

    return (response?.object as CosmicHomepageData) || null;
  } catch (error) {
    console.error('Error fetching homepage by ID:', error);
    return null;
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
    const response = await cosmic.objects
      .findOne({ id })
      .props('slug,title,metadata,type')
      .depth(1);

    return (response?.object as HomepageSectionItem) || null;
  } catch (error) {
    console.error('Error fetching Cosmic object by ID:', error, { id });
    return null;
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
  try {
    const processedSections = await Promise.all(
      colouredSections.map(async section => {
        if (section.items && Array.isArray(section.items)) {
          const fetchedItems = await Promise.all(
            section.items.map(async (item: { id?: string }) => {
              if (item.id && typeof item.id === 'string') {
                const fetchedItem = await fetchCosmicObjectById(item.id);
                return fetchedItem || item;
              }
              return item;
            })
          );
          return {
            ...section,
            items: fetchedItems.filter(Boolean),
          };
        }
        return section;
      })
    );

    return processedSections.filter(Boolean);
  } catch (error) {
    console.error('Error creating coloured sections:', error);
    return colouredSections;
  }
}
