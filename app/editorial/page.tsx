'use client';

import { getPostsWithFilters, getPostCategories, getEditorialPageConfig } from '@/lib/actions';
import { PageHeader } from '@/components/shared/page-header';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostObject } from '@/lib/cosmic-config';
import FeaturedContent from '../../components/editorial/featured-content';
import EditorialSection from '../../components/editorial/editorial-section';
import EditorialCategorySection from '../../components/editorial/editorial-category-section';
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

function EditorialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<PostObject[]>([]);
  const [featuredPost, setFeaturedPost] = useState<PostObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({
    article: [],
    video: [],
    categories: [],
  });
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<CategoryOrder[]>([]);

  // Get current filters from URL
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

  // Fetch all categories and page config on mount
  useEffect(() => {
    const loadCategoriesAndConfig = async () => {
      try {
        const [categoriesData, pageConfig] = await Promise.all([
          getPostCategories(),
          getEditorialPageConfig(),
        ]);

        setAvailableFilters(prev => ({
          ...prev,
          article: [
            {
              id: 'article',
              title: 'Article',
              slug: 'article',
              type: 'type',
              content: '',
              status: 'published',
              created_at: new Date().toISOString(),
              metadata: null,
            },
          ],
          video: [
            {
              id: 'video',
              title: 'Video',
              slug: 'video',
              type: 'type',
              content: '',
              status: 'published',
              created_at: new Date().toISOString(),
              metadata: null,
            },
          ],
          categories: categoriesData
            .map(cat => ({
              id: cat.id,
              title: cat.title,
              slug: cat.slug,
              type: 'category',
              content: cat.content || '',
              status: cat.status || 'published',
              created_at: cat.created_at,
              metadata: cat.metadata,
            }))
            .sort((a, b) => a.title.localeCompare(b.title)),
        }));

        // Set category order from page config
        if (pageConfig?.category_order && pageConfig.category_order.length > 0) {
          setCategoryOrder(pageConfig.category_order);
        }

        setCategoriesLoaded(true);
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategoriesLoaded(true);
      }
    };

    loadCategoriesAndConfig();
  }, []);

  // Fetch posts when filters change (but only after categories are loaded)
  useEffect(() => {
    if (!categoriesLoaded) {
      return;
    }

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        // Convert category slugs to IDs for the Cosmic query
        const categoryIds = currentFilters.categories
          .map(slug => {
            const category = availableFilters.categories.find(cat => cat.slug === slug);
            return category?.id;
          })
          .filter(Boolean) as string[];

        // Fetch featured post only when no filters are active
        const hasFilters =
          currentFilters.article ||
          currentFilters.video ||
          categoryIds.length > 0 ||
          currentFilters.search;

        if (!hasFilters) {
          const featuredResult = await getPostsWithFilters({
            limit: 1,
            offset: 0,
            featured: true,
          });

          if (featuredResult.posts.length > 0) {
            setFeaturedPost(featuredResult.posts[0]);
          } else {
            setFeaturedPost(null);
          }
        } else {
          setFeaturedPost(null);
        }

        const postsResult = await getPostsWithFilters({
          limit: 100, // Fetch more to allow grouping
          offset: 0,
          searchTerm: currentFilters.search,
          categories: categoryIds,
          postType: currentFilters.article ? 'article' : currentFilters.video ? 'video' : undefined,
        });

        setPosts(postsResult.posts);
        setTotal(postsResult.total);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
        setTotal(0);
        setFeaturedPost(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [currentFilters, categoriesLoaded, availableFilters.categories]);

  // Update search term from URL
  useEffect(() => {
    setSearchTerm(currentFilters.search);
  }, [currentFilters.search]);

  // Update URL when search term changes (debounced)
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

  // Group posts by category for display
  const groupedPosts = useMemo(() => {
    if (
      !categoryOrder.length ||
      currentFilters.article ||
      currentFilters.video ||
      currentFilters.categories.length > 0 ||
      currentFilters.search
    ) {
      return null; // Don't group when filters are active
    }

    const groups: { category: CategoryOrder; posts: PostObject[] }[] = [];
    const usedPostIds = new Set<string>();

    // Group posts by ordered categories
    for (const category of categoryOrder) {
      const categoryPosts = posts.filter(post => {
        if (usedPostIds.has(post.id)) return false;
        const postCategories = post.metadata?.categories || [];
        return postCategories.some(
          (cat: any) => cat.id === category.id || cat.slug === category.slug
        );
      });

      if (categoryPosts.length > 0) {
        categoryPosts.forEach(p => usedPostIds.add(p.id));
        groups.push({ category, posts: categoryPosts });
      }
    }

    // Add uncategorized posts
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

  return (
    <div className='w-full overflow-x-hidden mb-20'>
      <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
        <div className='absolute inset-0 bg-sunset' />
        <div
          className='absolute inset-0 bg-linear-to-b from-white via-white/0 to-white'
          style={{ mixBlendMode: 'hue' }}
        />
        <div
          className='absolute inset-0'
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
            mixBlendMode: 'screen',
          }}
        />
        <div className='absolute bottom-0 left-0 w-full px-5 z-10'>
          <PageHeader title='editorial' />
        </div>
      </div>

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

      <div className='px-5'>
        {isLoading ? (
          <div className='py-5 text-center'>
            <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white'>
              Loading...
            </h3>
          </div>
        ) : posts.length > 0 ? (
          <>
            {!hasFiltersActive && groupedPosts ? (
              <>
                {/* Featured post - use featured post if available, otherwise first post from first category group */}
                {(featuredPost || groupedPosts[0]?.posts[0]) && (
                  <FeaturedContent posts={[featuredPost || groupedPosts[0].posts[0]]} />
                )}

                {/* Category-grouped sections */}
                {groupedPosts.map((group, index) => {
                  // Skip the featured post if it's in this group
                  let postsToShow = group.posts;
                  if (index === 0 && featuredPost) {
                    // If we have a featured post, check if it's in the first group
                    const featuredInGroup = group.posts.some(p => p.id === featuredPost.id);
                    if (featuredInGroup) {
                      postsToShow = group.posts.filter(p => p.id !== featuredPost.id);
                    } else {
                      postsToShow = group.posts;
                    }
                  } else if (index === 0 && !featuredPost) {
                    // If no featured post, skip the first post of the first group
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
                {/* Featured post - use featured post if available, otherwise latest post */}
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
        ) : (
          <div className='py-5 text-center'>
            <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white'>
              No posts found
            </h3>
            <p className='text-gray-500 mt-2'>Try adjusting your filters or search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditorialPage() {
  return (
    <div className='min-h-screen'>
      <Suspense>
        <EditorialContent />
      </Suspense>
    </div>
  );
}
