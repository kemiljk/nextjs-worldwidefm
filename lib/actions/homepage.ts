'use server';

import { CosmicHomepageData, HomepageSectionItem, ProcessedHomepageSection } from '../cosmic-types';
import { cosmic } from '../cosmic-config';

export async function getCosmicHomepageData(): Promise<CosmicHomepageData | null> {
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

    const COSMIC_HOMEPAGE_ID = process.env.NEXT_PUBLIC_COSMIC_HOMEPAGE_ID;
    if (COSMIC_HOMEPAGE_ID && COSMIC_HOMEPAGE_ID !== 'undefined') {
      const fallbackResponse = await cosmic.objects
        .findOne({ id: COSMIC_HOMEPAGE_ID })
        .props('slug,title,metadata,type')
        .depth(4);

      if (fallbackResponse?.object) {
        return fallbackResponse.object as CosmicHomepageData;
      }
    }

    console.error('Failed to fetch Cosmic homepage data: No homepage object found');
    return null;
  } catch (error) {
    console.error('Error fetching Cosmic homepage data:', error);
    return null;
  }
}

export async function fetchCosmicObjectById(id: string): Promise<HomepageSectionItem | null> {
  try {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return null;
    }

    const trimmedId = id.trim();

    const response = await cosmic.objects
      .findOne({ id: trimmedId })
      .props('slug,title,metadata,type')
      .depth(1);

    if (!response?.object) {
      return null;
    }

    return response.object as HomepageSectionItem;
  } catch (error) {
    console.error('Error fetching Cosmic object by ID:', error, { id });
    return null;
  }
}

export async function createColouredSections(
  colouredSections: ProcessedHomepageSection[]
): Promise<ProcessedHomepageSection[]> {
  try {
    const processedSections = await Promise.all(
      colouredSections.map(async section => {
        if (section.items && Array.isArray(section.items)) {
          const fetchedItems = await Promise.all(
            section.items.map(async (item: any) => {
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
