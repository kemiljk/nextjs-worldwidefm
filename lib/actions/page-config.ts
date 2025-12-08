'use server';

import { cosmic } from '../cosmic-config';

export interface CategoryOrder {
  id: string;
  slug: string;
  title: string;
}

export interface PageConfig {
  category_order: CategoryOrder[];
}

export async function getEditorialPageConfig(): Promise<PageConfig | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'editorial-page-config',
        status: 'published',
      })
      .depth(2);

    if (!response?.object) {
      return null;
    }

    const categoryOrder = (response.object.metadata?.category_order || []).map((cat: any) => ({
      id: cat.id,
      slug: cat.slug,
      title: cat.title,
    }));

    return {
      category_order: categoryOrder,
    };
  } catch (error) {
    console.error('Error fetching editorial page config:', error);
    return null;
  }
}

export async function getVideosPageConfig(): Promise<PageConfig | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'videos-page-config',
        status: 'published',
      })
      .depth(2);

    if (!response?.object) {
      return null;
    }

    const categoryOrder = (response.object.metadata?.category_order || []).map((cat: any) => ({
      id: cat.id,
      slug: cat.slug,
      title: cat.title,
    }));

    return {
      category_order: categoryOrder,
    };
  } catch (error) {
    console.error('Error fetching videos page config:', error);
    return null;
  }
}





