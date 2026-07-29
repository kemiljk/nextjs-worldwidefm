'use cache';

import { cacheLife, cacheTag } from 'next/cache';
import { getPostsWithFilters, getPostCategories } from './actions/posts';
import { getEditorialPageConfig } from './actions/page-config';
import type { PostObject } from './cosmic-config';
import type { CategoryOrder } from './actions/page-config';

export interface EditorialLandingData {
  categories: unknown[];
  categoryOrder: CategoryOrder[];
  featuredPost: PostObject | null;
  posts: PostObject[];
  total: number;
}

export async function getEditorialLandingData(): Promise<EditorialLandingData> {
  cacheLife('editorial');
  cacheTag('editorial', 'posts', 'categories');

  const [categories, pageConfig, featuredResult, postsResult] = await Promise.all([
    getPostCategories(),
    getEditorialPageConfig(),
    getPostsWithFilters({ limit: 1, offset: 0, featured: true }),
    getPostsWithFilters({ limit: 100, offset: 0 }),
  ]);

  return {
    categories,
    categoryOrder: pageConfig?.category_order ?? [],
    featuredPost: featuredResult.posts[0] ?? null,
    posts: postsResult.posts,
    total: postsResult.total,
  };
}
