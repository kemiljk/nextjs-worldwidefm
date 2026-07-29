'use client';

import { getPostsWithFilters } from '@/lib/actions';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostObject } from '@/lib/cosmic-config';
import FeaturedContent from '@/components/editorial/featured-content';
import EditorialSection from '@/components/editorial/editorial-section';
import EditorialCategorySection from '@/components/editorial/editorial-category-section';
import { FilterItem as BaseFilterItem } from '@/lib/filter-types';
import { FilterToolbar } from './components/filter-toolbar';
import { useDebounce } from '@/hooks/use-debounce';
import type { CategoryOrder } from '@/lib/actions/page-config';

type FilterItem = BaseFilterItem;

interface AvailableFilters {
  [key: string]: FilterItem[];
  article: FilterItem[];
  video: FilterItem[];
  categories: FilterItem[];
}

interface CachedEditorialResult {
  posts: PostObject[];
  featuredPost: PostObject | null;
  total: number;
}

interface EditorialClientProps {
  initialPosts: PostObject[];
  initialFeaturedPost: PostObject | null;
  initialTotal: number;
  initialAvailableFilters: AvailableFilters;
  initialCategoryOrder: CategoryOrder[];
}

function buildCacheKey(filters: {
  categories: string[];
  article: boolean;
  video: boolean;
  search: string;
}): string {
  return JSON.stringify(filters);
}

export default function EditorialClient({
  initialPosts,
  initialFeaturedPost,
  initialTotal,
  initialAvailableFilters,
  initialCategoryOrder,
}: EditorialClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<PostObject[]>(initialPosts);
  const [featuredPost, setFeaturedPost] = useState<PostObject | null>(initialFeaturedPost);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [availableFilters] = useState<AvailableFilters>(initialAvailableFilters);
  const [categoryOrder] = useState<CategoryOrder[]>(initialCategoryOrder);

  const resultsCache = useRef<Map<string, CachedEditorialResult>>(new Map());
  const fetchRequestId = useRef(0);
  const hasMounted = useRef(false);

  const currentFilters = useMemo(() => {
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const article = searchParams.get('article') === 'true';
    const video = searchParams.get('video') === 'true';
    const search = searchParams.get('search') || '';

    return {
      categories,
      article,
      video,
      search,
    };
  }, [searchParams]);

  const cacheKey = useMemo(() => buildCacheKey(currentFilters), [currentFilters]);

  const defaultCacheKey = buildCacheKey({
    categories: [],
    article: false,
    video: false,
    search: '',
  });
  if (!resultsCache.current.has(defaultCacheKey)) {
    resultsCache.current.set(defaultCacheKey, {
      posts: initialPosts,
      featuredPost: initialFeaturedPost,
      total: initialTotal,
    });
  }

  useEffect(() => {
    const isDefaultView = cacheKey === defaultCacheKey;
    if (!hasMounted.current && isDefaultView) {
      hasMounted.current = true;
      return;
    }

    const fetchPosts = async () => {
      const cached = resultsCache.current.get(cacheKey);
      if (cached) {
        setPosts(cached.posts);
        setFeaturedPost(cached.featuredPost);
        setTotal(cached.total);
      }

      const requestId = ++fetchRequestId.current;
      const shouldIndicateRefresh = hasMounted.current || !isDefaultView;

      if (shouldIndicateRefresh) {
        setIsRefreshing(true);
      }
      hasMounted.current = true;

      try {
        const categoryIds = currentFilters.categories
          .map(slug => {
            const category = availableFilters.categories.find(cat => cat.slug === slug);
            return category?.id;
          })
          .filter(Boolean) as string[];

        const hasFilters =
          currentFilters.article ||
          currentFilters.video ||
          categoryIds.length > 0 ||
          currentFilters.search;

        let nextFeatured: PostObject | null = null;

        if (!hasFilters) {
          const featuredResult = await getPostsWithFilters({
            limit: 1,
            offset: 0,
            featured: true,
          });

          if (featuredResult.posts.length > 0) {
            nextFeatured = featuredResult.posts[0];
          }
        }

        const postsResult = await getPostsWithFilters({
          limit: 100,
          offset: 0,
          searchTerm: currentFilters.search,
          categories: categoryIds,
          postType: currentFilters.article ? 'article' : currentFilters.video ? 'video' : undefined,
        });

        if (requestId !== fetchRequestId.current) {
          return;
        }

        const result: CachedEditorialResult = {
          posts: postsResult.posts,
          featuredPost: nextFeatured,
          total: postsResult.total,
        };

        resultsCache.current.set(cacheKey, result);
        setPosts(result.posts);
        setFeaturedPost(result.featuredPost);
        setTotal(result.total);
      } catch (error) {
        console.error('Error fetching posts:', error);
        if (requestId === fetchRequestId.current && !cached) {
          setPosts([]);
          setTotal(0);
          setFeaturedPost(null);
        }
      } finally {
        if (requestId === fetchRequestId.current) {
          setIsRefreshing(false);
        }
      }
    };

    fetchPosts();
  }, [cacheKey, currentFilters, availableFilters.categories]);

  useEffect(() => {
    setSearchTerm(currentFilters.search);
  }, [currentFilters.search]);

  useEffect(() => {
    if (debouncedSearchTerm !== currentFilters.search) {
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedSearchTerm) {
        params.set('search', debouncedSearchTerm);
      } else {
        params.delete('search');
      }
      router.push(`?${params.toString()}`, { scroll: false });
    }
  }, [debouncedSearchTerm, currentFilters.search, router, searchParams]);

  const handleFilterChange = (filter: string, subfilter?: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!filter) {
      params.delete('categories');
      params.delete('article');
      params.delete('video');
    } else if (filter === 'article') {
      if (params.get('article') === 'true') {
        params.delete('article');
      } else {
        params.set('article', 'true');
        params.delete('video');
      }
      params.delete('categories');
    } else if (filter === 'video') {
      if (params.get('video') === 'true') {
        params.delete('video');
      } else {
        params.set('video', 'true');
        params.delete('article');
      }
      params.delete('categories');
    } else if (subfilter) {
      const currentValues = params.get(filter)?.split(',').filter(Boolean) || [];
      const index = currentValues.indexOf(subfilter);

      if (index > -1) {
        currentValues.splice(index, 1);
      } else {
        currentValues.push(subfilter);
      }

      if (currentValues.length > 0) {
        params.set(filter, currentValues.join(','));
      } else {
        params.delete(filter);
      }

      params.delete('article');
      params.delete('video');
    }

    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
  };

  const activeFilter =
    currentFilters.categories.length > 0
      ? 'categories'
      : currentFilters.article
        ? 'article'
        : currentFilters.video
          ? 'video'
          : '';

  const selectedFilters = {
    article: currentFilters.article ? ['article'] : [],
    video: currentFilters.video ? ['video'] : [],
    categories: currentFilters.categories,
  };

  const groupedPosts = useMemo(() => {
    if (
      !categoryOrder.length ||
      currentFilters.article ||
      currentFilters.video ||
      currentFilters.categories.length > 0 ||
      currentFilters.search
    ) {
      return null;
    }

    const groups: { category: CategoryOrder; posts: PostObject[] }[] = [];
    const usedPostIds = new Set<string>();

    for (const category of categoryOrder) {
      const categoryPosts = posts.filter(post => {
        if (usedPostIds.has(post.id)) return false;
        const postCategories = post.metadata?.categories || [];
        return postCategories.some(
          (cat: { id?: string; slug?: string }) =>
            cat.id === category.id || cat.slug === category.slug
        );
      });

      if (categoryPosts.length > 0) {
        categoryPosts.forEach(p => usedPostIds.add(p.id));
        groups.push({ category, posts: categoryPosts });
      }
    }

    const uncategorizedPosts = posts.filter(post => !usedPostIds.has(post.id));
    if (uncategorizedPosts.length > 0) {
      groups.push({
        category: { id: 'uncategorized', slug: 'uncategorized', title: 'Other' },
        posts: uncategorizedPosts,
      });
    }

    return groups;
  }, [posts, categoryOrder, currentFilters]);

  const hasFiltersActive =
    currentFilters.article ||
    currentFilters.video ||
    currentFilters.categories.length > 0 ||
    currentFilters.search;

  const showEmptyState = posts.length === 0 && !isRefreshing;

  return (
  <>
      <div className='px-5'>
        <FilterToolbar
          availableFilters={availableFilters}
          activeFilter={activeFilter}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
        />
      </div>

      <div
        className={`px-5 transition-opacity duration-200 ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}
        aria-busy={isRefreshing}
      >
        {showEmptyState ? (
          <div className='py-5 text-center'>
            <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white'>
              No posts found
            </h3>
            <p className='text-gray-500 mt-2'>Try adjusting your filters or search term.</p>
          </div>
        ) : posts.length > 0 ? (
          <>
            {!hasFiltersActive && groupedPosts ? (
              <>
                {(featuredPost || groupedPosts[0]?.posts[0]) && (
                  <FeaturedContent posts={[featuredPost || groupedPosts[0].posts[0]]} />
                )}

                {groupedPosts.map((group, index) => {
                  let postsToShow = group.posts;
                  if (index === 0 && featuredPost) {
                    const featuredInGroup = group.posts.some(p => p.id === featuredPost.id);
                    if (featuredInGroup) {
                      postsToShow = group.posts.filter(p => p.id !== featuredPost.id);
                    } else {
                      postsToShow = group.posts;
                    }
                  } else if (index === 0 && !featuredPost) {
                    postsToShow = group.posts.slice(1);
                  }

                  if (postsToShow.length === 0) return null;

                  return (
                    <EditorialCategorySection
                      key={group.category.id}
                      title={group.category.title}
                      posts={postsToShow}
                    />
                  );
                })}
              </>
            ) : !hasFiltersActive ? (
              <>
                {(featuredPost || posts[0]) && (
                  <FeaturedContent posts={[featuredPost || posts[0]]} />
                )}
                <EditorialSection
                  title='All Posts'
                  posts={
                    featuredPost ? posts.filter(p => p.id !== featuredPost.id) : posts.slice(1)
                  }
                  currentFilters={{
                    searchTerm: currentFilters.search,
                    categories: currentFilters.categories,
                    postType: currentFilters.article
                      ? 'article'
                      : currentFilters.video
                        ? 'video'
                        : undefined,
                  }}
                  availableFilters={availableFilters}
                />
              </>
            ) : (
              <EditorialSection
                title={
                  currentFilters.article
                    ? 'Articles'
                    : currentFilters.video
                      ? 'Videos'
                      : currentFilters.categories.length > 0
                        ? 'Filtered Posts'
                        : currentFilters.search
                          ? 'Search Results'
                          : 'All Posts'
                }
                posts={posts}
                currentFilters={{
                  searchTerm: currentFilters.search,
                  categories: currentFilters.categories,
                  postType: currentFilters.article
                    ? 'article'
                    : currentFilters.video
                      ? 'video'
                      : undefined,
                }}
                availableFilters={availableFilters}
              />
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
