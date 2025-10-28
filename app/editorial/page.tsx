'use client';

import { getPostsWithFilters, getPostCategories, getAllEvents } from '@/lib/actions';
import { PageHeader } from '@/components/shared/page-header';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostObject } from '@/lib/cosmic-config';
import { EventType } from '@/lib/cosmic-types';
import FeaturedContent from '../../components/editorial/featured-content';
import EditorialSection from '../../components/editorial/editorial-section';
import { FilterItem as BaseFilterItem } from '@/lib/filter-types';
import { FilterToolbar } from './components/filter-toolbar';
import { useDebounce } from '@/hooks/use-debounce';

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
  const [events, setEvents] = useState<EventType[]>([]);
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

  // Fetch all categories on mount to enable filtering
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await getPostCategories();

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

        setCategoriesLoaded(true);
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategoriesLoaded(true);
      }
    };

    loadCategories();
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

        // Fetch posts and events in parallel
        const [postsResult, eventsResult] = await Promise.all([
          getPostsWithFilters({
            limit: 20,
            offset: 0,
            searchTerm: currentFilters.search,
            categories: categoryIds,
            postType: currentFilters.article
              ? 'article'
              : currentFilters.video
                ? 'video'
                : undefined,
          }),
          getAllEvents({
            limit: 20,
            offset: 0,
            searchTerm: currentFilters.search,
          }),
        ]);

        console.log(
          'Fetched',
          postsResult.posts.length,
          'posts and',
          eventsResult.events.length,
          'events with filters:',
          {
            categoryIds,
            categorySlugs: currentFilters.categories,
            postType: currentFilters.article
              ? 'article'
              : currentFilters.video
                ? 'video'
                : undefined,
          }
        );
        setPosts(postsResult.posts);
        setEvents(eventsResult.events);
        setTotal(postsResult.total);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
        setEvents([]);
        setTotal(0);
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

    // Clear all filters
    if (!filter) {
      params.delete('categories');
      params.delete('article');
      params.delete('video');
    } else if (filter === 'article') {
      // Toggle article filter
      if (params.get('article') === 'true') {
        params.delete('article');
      } else {
        params.set('article', 'true');
        params.delete('video'); // Remove video if article is selected
      }
      params.delete('categories');
    } else if (filter === 'video') {
      // Toggle video filter
      if (params.get('video') === 'true') {
        params.delete('video');
      } else {
        params.set('video', 'true');
        params.delete('article'); // Remove article if video is selected
      }
      params.delete('categories');
    } else if (subfilter) {
      // Handle subfilter selection (categories)
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

      // Clear article/video filters when selecting categories
      params.delete('article');
      params.delete('video');
    }

    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
  };

  // Determine active filter for UI
  const activeFilter =
    currentFilters.categories.length > 0
      ? 'categories'
      : currentFilters.article
        ? 'article'
        : currentFilters.video
          ? 'video'
          : '';

  // Convert URL params to selected filters format for UI
  const selectedFilters = {
    article: currentFilters.article ? ['article'] : [],
    video: currentFilters.video ? ['video'] : [],
    categories: currentFilters.categories,
  };

  return (
    <div className='w-full overflow-x-hidden mb-20'>
      <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
        <div className='absolute inset-0 bg-sunset' />

        {/* Linear white gradient */}
        <div
          className='absolute inset-0 bg-linear-to-b from-white via-white/0 to-white'
          style={{ mixBlendMode: 'hue' }}
        />

        {/* Noise Overlay */}
        <div
          className='absolute inset-0'
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
            mixBlendMode: 'screen',
          }}
        />
        <div className='absolute bottom-0 left-0 w-full px-5  z-10'>
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
            {/* Only show featured content when no filters are active */}
            {!currentFilters.article &&
            !currentFilters.video &&
            currentFilters.categories.length === 0 &&
            !currentFilters.search ? (
              <>
                <FeaturedContent posts={posts.slice(0, 1)} />
                <EditorialSection
                  title='All Posts'
                  posts={posts.slice(1)}
                  events={events}
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
                events={events}
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

// Main component that uses Suspense
export default function EditorialPage() {
  return (
    <div className='min-h-screen'>
      <Suspense>
        <EditorialContent />
      </Suspense>
    </div>
  );
}
