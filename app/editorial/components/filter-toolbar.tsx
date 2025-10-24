'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { FilterItem } from '@/lib/filter-types';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { Badge } from '@/components/ui/badge';

interface FilterToolbarProps {
  onFilterChange: (filter: string, subfilter?: string) => void;
  onSearchChange?: (term: string) => void;
  searchTerm?: string;
  activeFilter: string;
  selectedFilters: { [key: string]: string[] };
  availableFilters: {
    [key: string]: FilterItem[];
  };
}

export function FilterToolbar({
  onFilterChange,
  onSearchChange,
  searchTerm = '',
  activeFilter,
  selectedFilters,
  availableFilters,
}: FilterToolbarProps) {
  // Handle "Article" filter button (acts as toggle)
  const handleArticleClick = () => {
    if (activeFilter === 'article') {
      onFilterChange('');
    } else {
      onFilterChange('article');
    }
  };

  // Handle "Video" filter button (acts as toggle)
  const handleVideoClick = () => {
    if (activeFilter === 'video') {
      onFilterChange('');
    } else {
      onFilterChange('video');
    }
  };

  // Handle dropdown selection changes
  const handleSelectionChange = (filterType: string) => (values: string[]) => {
    const currentSelected = selectedFilters[filterType] || [];

    // Find what changed
    const added = values.filter(v => !currentSelected.includes(v));
    const removed = currentSelected.filter(v => !values.includes(v));

    // Handle additions
    added.forEach(value => {
      onFilterChange(filterType, value);
    });

    // Handle removals
    removed.forEach(value => {
      onFilterChange(filterType, value);
    });

    // If no items selected, clear all filters
    if (values.length === 0) {
      onFilterChange('');
    }
  };

  const handleClearFilter = (filterType: string, value?: string) => {
    if (value) {
      onFilterChange(filterType, value); // This will toggle the item
    }
  };

  // Get all active filter chips
  const getActiveChips = () => {
    const chips: Array<{ type: string; value: string; label: string }> = [];

    // Add article filters
    if (selectedFilters.article?.length > 0) {
      selectedFilters.article.forEach(slug => {
        const item = availableFilters.article?.find(f => f.slug === slug);
        chips.push({
          type: 'article',
          value: slug,
          label: item?.title || slug,
        });
      });
    }

    // Add video filters
    if (selectedFilters.video?.length > 0) {
      selectedFilters.video.forEach(slug => {
        const item = availableFilters.video?.find(f => f.slug === slug);
        chips.push({
          type: 'video',
          value: slug,
          label: item?.title || slug,
        });
      });
    }

    // Add category filters
    if (selectedFilters.categories?.length > 0) {
      selectedFilters.categories.forEach(slug => {
        const item = availableFilters.categories?.find(f => f.slug === slug);
        chips.push({
          type: 'categories',
          value: slug,
          label: item?.title || slug,
        });
      });
    }

    return chips;
  };

  return (
    <div className='flex flex-row flex-wrap items-start justify-between gap-2 h-auto pt-4 pb-2'>
      <div className='flex flex-col gap-4'>
        {/* Main Filter Controls */}
        <div className='flex flex-wrap gap-2 text-m7'>
          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              !activeFilter && 'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={() => onFilterChange('')}
          >
            All
          </Button>

          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeFilter === 'article' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={handleArticleClick}
          >
            Articles
          </Button>

          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeFilter === 'video' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={handleVideoClick}
          >
            Videos
          </Button>

          <MultiSelectDropdown
            options={
              availableFilters.categories?.map(item => ({
                id: item.id,
                title: item.title,
                slug: item.slug,
              })) || []
            }
            selectedValues={selectedFilters.categories || []}
            onSelectionChange={handleSelectionChange('categories')}
            placeholder='Categories'
          />
        </div>

        {/* Active Filter Chips */}
        {getActiveChips().length > 0 && (
          <div className='w-full border-t border-almostblack flex gap-2 pt-4 pb-2 text-[15px] overflow-x-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700'>
            {getActiveChips().map((chip, index) => (
              <Badge
                key={`${chip.type}-${chip.value}-${index}`}
                variant='default'
                className='font-mono cursor-pointer border border-almostblack hover:bg-white whitespace-nowrap bg-white text-almostblack flex items-center gap-1'
              >
                {chip.label}
                <X
                  className='h-3 w-3'
                  onClick={e => {
                    e.stopPropagation();
                    handleClearFilter(chip.type, chip.value);
                  }}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>
      {/* Search Bar */}
      {onSearchChange && (
        <div className='relative w-auto h-auto flex flex-row bg-background border border-almostblack dark:border-white items-center text-almostblack self-start'>
          <Input
            placeholder='Search editorial...'
            className='flex flex-wrap gap-2 h-full px-2 py-1.5  font-mono text-[14px]'
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          <Search className='relative text-muted-foreground h-4 w-4 mr-2 pointer-events-none' />
        </div>
      )}
    </div>
  );
}
