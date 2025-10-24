'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { Badge } from '@/components/ui/badge';

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

interface VideoFilterToolbarProps {
  onFilterChange: (filter: string, subfilter?: string) => void;
  onSearchChange?: (term: string) => void;
  searchTerm?: string;
  activeFilter: string;
  selectedFilters: { [key: string]: string[] };
  availableCategories: VideoCategory[];
}

export function VideoFilterToolbar({
  onFilterChange,
  onSearchChange,
  searchTerm = '',
  activeFilter,
  selectedFilters,
  availableCategories,
}: VideoFilterToolbarProps) {
  const handleNewClick = () => {
    if (activeFilter === 'new') {
      onFilterChange('');
    } else {
      onFilterChange('new');
    }
  };

  const handleCategorySelectionChange = (values: string[]) => {
    const currentSelected = selectedFilters.categories || [];

    // Find what changed
    const added = values.filter(v => !currentSelected.includes(v));
    const removed = currentSelected.filter(v => !values.includes(v));

    // Handle additions
    added.forEach(value => {
      onFilterChange('categories', value);
    });

    // Handle removals
    removed.forEach(value => {
      onFilterChange('categories', value);
    });

    // If no categories selected, clear all filters
    if (values.length === 0) {
      onFilterChange('');
    }
  };

  const handleClearFilter = (filterType: string, value?: string) => {
    if (filterType === 'new') {
      onFilterChange('');
    } else if (filterType === 'categories' && value) {
      onFilterChange('categories', value); // This will toggle the category
    }
  };

  // Get all active filter chips
  const getActiveChips = () => {
    const chips: Array<{ type: string; value: string; label: string }> = [];

    if (activeFilter === 'new') {
      chips.push({ type: 'new', value: 'new', label: 'New' });
    }

    if (selectedFilters.categories?.length > 0) {
      selectedFilters.categories.forEach(categoryTitle => {
        chips.push({
          type: 'categories',
          value: categoryTitle,
          label: categoryTitle,
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
              activeFilter === 'new' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={handleNewClick}
          >
            New
          </Button>

          <MultiSelectDropdown
            options={availableCategories.map(cat => ({
              id: cat.id,
              title: cat.title,
              slug: cat.title,
            }))}
            selectedValues={selectedFilters.categories || []}
            onSelectionChange={handleCategorySelectionChange}
            placeholder='Categories'
          />
        </div>

        {/* Active Filter Chips */}
        {getActiveChips().length > 0 && (
          <div className='w-full border-t border-almostblack flex gap-2 pt-4 pb-2 text-m7 overflow-x-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700'>
            {getActiveChips().map((chip, index) => (
              <Badge
                key={`${chip.type}-${chip.value}-${index}`}
                variant='default'
                className='font-mono uppercase cursor-pointer border border-almostblack hover:bg-white whitespace-nowrap bg-white text-almostblack flex items-center gap-1'
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
            placeholder='Search videos...'
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
