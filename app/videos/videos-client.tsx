'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoGrid from '@/components/video/video-grid';
import { VideoObject } from '@/lib/cosmic-config';
import { subDays } from 'date-fns';
import { VideoFilterToolbar } from './components/video-filter-toolbar';
import { useDebounce } from '@/hooks/use-debounce';

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
}

export default function VideosClient({ initialVideos, availableCategories }: VideosClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeFilter, setActiveFilter] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: string[] }>({
    categories: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);

  // Load URL query parameters on initial render
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
  }, [searchParams]);

  // Update URL when filters change
  const updateUrlParams = useCallback(() => {
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

    // Update URL without refreshing the page
    router.push(`/videos${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [activeFilter, selectedFilters, debouncedSearchTerm, router]);

  // Update URL when filters change
  useEffect(() => {
    updateUrlParams();
  }, [activeFilter, selectedFilters, debouncedSearchTerm, updateUrlParams]);

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
        // Map category IDs to full objects
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

      {filteredVideos.length > 0 ? (
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
