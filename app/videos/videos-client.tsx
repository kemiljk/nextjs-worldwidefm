'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoGrid from '@/components/video/video-grid';
import FeaturedVideoContent from '@/components/video/featured-video-content';
import VideoCategorySection from '@/components/video/video-category-section';
import { VideoObject } from '@/lib/cosmic-config';
import { subDays } from 'date-fns';
import { VideoFilterToolbar } from './components/video-filter-toolbar';
import { useDebounce } from '@/hooks/use-debounce';
import type { CategoryOrder } from '@/lib/actions/page-config';

interface VideoCategory {
  id: string;
  title: string;
  slug: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  metadata: null;
}

interface VideosClientProps {
  initialVideos: VideoObject[];
  availableCategories: VideoCategory[];
  categoryOrder?: CategoryOrder[];
}

export default function VideosClient({ initialVideos, availableCategories, categoryOrder = [] }: VideosClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeFilter, setActiveFilter] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: string[] }>({
    categories: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);

  // Track if we're syncing from URL to prevent loops
  const [isInitialized, setIsInitialized] = useState(false);

  // Load URL query parameters on initial render only
  useEffect(() => {
    const categoriesParam = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const searchParam = searchParams.get('search') || '';
    const newParam = searchParams.get('new');

    // Set active filter if any are present
    if (newParam === 'true') {
      setActiveFilter('new');
    } else if (categoriesParam.length) {
      setActiveFilter('categories');
    }

    // Set filter values
    setSelectedFilters({
      categories: categoriesParam,
    });

    // Set search term
    if (searchParam) {
      setSearchTerm(searchParam);
    }
    
    setIsInitialized(true);
  }, []); // Only run once on mount

  // Update URL when filters change (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams();

    // Add active filters to URL
    if (activeFilter === 'new') {
      params.set('new', 'true');
    } else {
      if (selectedFilters.categories.length) {
        params.set('categories', selectedFilters.categories.join(','));
      }
    }

    // Add search term to URL
    if (debouncedSearchTerm) {
      params.set('search', debouncedSearchTerm);
    }

    const newUrl = `/videos${params.toString() ? `?${params.toString()}` : ''}`;
    const currentUrl = `/videos${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    // Only update if URL actually changed
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [activeFilter, selectedFilters, debouncedSearchTerm, isInitialized, router, searchParams]);

  const handleFilterChange = (filter: string, subfilter?: string) => {
    // Clear all filters
    if (!filter) {
      setActiveFilter('');
      setSelectedFilters({
        categories: [],
      });
      return;
    }

    // Handle "new" filter (exclusive)
    if (filter === 'new') {
      setActiveFilter(filter);
      setSelectedFilters({
        categories: [],
      });
      return;
    }

    // Always set activeFilter to 'categories' if a subfilter is selected
    if (subfilter) {
      setActiveFilter('categories');
      setSelectedFilters(prev => {
        const currentFilters = [...prev.categories];
        const index = currentFilters.indexOf(subfilter);
        // Toggle the filter
        if (index > -1) {
          currentFilters.splice(index, 1);
        } else {
          currentFilters.push(subfilter);
        }
        return {
          ...prev,
          categories: currentFilters,
        };
      });
      return;
    }

    // Set active filter category (for main filter buttons)
    setActiveFilter(filter);
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      activeFilter === 'new' ||
      selectedFilters.categories.length > 0 ||
      debouncedSearchTerm.length > 0
    );
  }, [activeFilter, selectedFilters.categories.length, debouncedSearchTerm]);

  // Separate featured videos from regular videos
  const { featuredVideos, regularVideos } = useMemo(() => {
    const featured = initialVideos.filter(video => video.metadata?.is_featured === true);
    const regular = initialVideos.filter(video => !video.metadata?.is_featured);
    return { featuredVideos: featured, regularVideos: regular };
  }, [initialVideos]);

  // Group regular videos by category
  const videosByCategory = useMemo(() => {
    const grouped: Record<string, { category: VideoCategory; videos: VideoObject[] }> = {};
    const uncategorized: VideoObject[] = [];

    regularVideos.forEach(video => {
      const videoCategories = video.metadata?.categories;
      if (!videoCategories || !Array.isArray(videoCategories) || videoCategories.length === 0) {
        uncategorized.push(video);
        return;
      }

      const firstCatId = typeof videoCategories[0] === 'string' 
        ? videoCategories[0] 
        : videoCategories[0]?.id;
      
      const category = availableCategories.find(cat => cat.id === firstCatId);
      
      if (category) {
        if (!grouped[category.id]) {
          grouped[category.id] = { category, videos: [] };
        }
        grouped[category.id].videos.push(video);
      } else {
        uncategorized.push(video);
      }
    });

    // Sort groups by categoryOrder if provided, otherwise alphabetically
    let sortedGroups: { category: VideoCategory; videos: VideoObject[] }[];
    
    if (categoryOrder.length > 0) {
      // Create ordered groups based on categoryOrder
      const orderedGroups: { category: VideoCategory; videos: VideoObject[] }[] = [];
      const usedCategoryIds = new Set<string>();

      // First, add groups in the order specified by categoryOrder
      for (const orderItem of categoryOrder) {
        if (grouped[orderItem.id]) {
          orderedGroups.push(grouped[orderItem.id]);
          usedCategoryIds.add(orderItem.id);
        }
      }

      // Then, add any remaining groups not in the order (alphabetically)
      const remainingGroups = Object.values(grouped)
        .filter(g => !usedCategoryIds.has(g.category.id))
        .sort((a, b) => a.category.title.localeCompare(b.category.title));
      
      sortedGroups = [...orderedGroups, ...remainingGroups];
    } else {
      // Fallback to alphabetical sorting
      sortedGroups = Object.values(grouped).sort((a, b) => 
        a.category.title.localeCompare(b.category.title)
      );
    }

    return { sortedGroups, uncategorized };
  }, [regularVideos, availableCategories, categoryOrder]);

  // Filter videos based on active filter
  const filteredVideos = useMemo(() => {
    if (!initialVideos.length) return [];

    let filtered = [...initialVideos];

    // Apply "new" filter if active
    if (activeFilter === 'new') {
      const thirtyDaysAgo = subDays(new Date(), 30);
      filtered = filtered.filter(video => {
        if (!video.metadata?.date) return false;
        const videoDate = new Date(video.metadata.date);
        return !isNaN(videoDate.getTime()) && videoDate >= thirtyDaysAgo;
      });
    }

    // Apply categories filter if there are selected categories
    if (selectedFilters.categories.length > 0) {
      filtered = filtered.filter(video => {
        if (!video.metadata?.categories) return false;
        const categoryObjects = Array.isArray(video.metadata.categories)
          ? video.metadata.categories
              .map(catId =>
                availableCategories.find(
                  cat => cat.id === (typeof catId === 'string' ? catId : catId?.id)
                )
              )
              .filter(Boolean)
          : [];
        return categoryObjects.some(cat => cat && selectedFilters.categories.includes(cat.title));
      });
    }

    // Apply search term if any
    if (debouncedSearchTerm) {
      const search = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        video =>
          video.title.toLowerCase().includes(search) ||
          (video.metadata.description && video.metadata.description.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [activeFilter, selectedFilters, debouncedSearchTerm, initialVideos, availableCategories]);

  return (
    <>
      <div className='pb-5'>
        <VideoFilterToolbar
          availableCategories={availableCategories}
          activeFilter={activeFilter}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>

      {!hasActiveFilters ? (
        <>
          {featuredVideos.length > 0 && (
            <FeaturedVideoContent
              videos={featuredVideos.slice(0, 1)}
              availableCategories={availableCategories}
            />
          )}
          {videosByCategory.sortedGroups.length > 0 ? (
            <>
              {videosByCategory.sortedGroups.map(({ category, videos }) => (
                <VideoCategorySection
                  key={category.id}
                  title={category.title}
                  videos={videos}
                  availableCategories={availableCategories}
                />
              ))}
              {videosByCategory.uncategorized.length > 0 && (
                <VideoCategorySection
                  title='Other Videos'
                  videos={videosByCategory.uncategorized}
                  availableCategories={availableCategories}
                />
              )}
            </>
          ) : videosByCategory.uncategorized.length > 0 ? (
            <VideoCategorySection
              title='All Videos'
              videos={videosByCategory.uncategorized}
              availableCategories={availableCategories}
            />
          ) : featuredVideos.length === 0 ? (
            <div className='text-center'>
              <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white'>
                No videos found
              </h3>
            </div>
          ) : null}
        </>
      ) : filteredVideos.length > 0 ? (
        <VideoGrid videos={filteredVideos} availableCategories={availableCategories} />
      ) : (
        <div className='text-center'>
          <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white'>
            No videos found
          </h3>
          <p className='text-gray-500 mt-2'>Try adjusting your filters or search term.</p>
        </div>
      )}
    </>
  );
}
