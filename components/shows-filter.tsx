'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FilterItem } from '@/lib/search-context';
import { useCallback, useState, useEffect } from 'react';
import { X, Filter } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface ShowsFilterProps {
  genres: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  selectedGenre?: string;
  selectedHost?: string;
  selectedTakeover?: string;
  searchTerm?: string;
  isNew?: boolean;
}

export function ShowsFilter({
  genres,
  hosts,
  takeovers,
  selectedGenre,
  selectedHost,
  selectedTakeover,
  searchTerm,
  isNew,
}: ShowsFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
  const debouncedSearchTerm = useDebounce(localSearchTerm, 1000);

  // Handle animation timing when opening/closing
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    } else if (!isClosing) {
      // Start closing animation
      setIsClosing(true);
      // Wait for animation to finish before hiding
      const timer = setTimeout(() => {
        setIsClosing(false);
      }, 300); // Same duration as the animation

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Function to close with animation
  const closeFilter = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Memoize the update function to prevent unnecessary re-renders
  const createQueryString = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === null) {
        params.delete(name);
      } else {
        params.set(name, value);
      }

      return params.toString();
    },
    [searchParams]
  );

  const updateFilters = useCallback(
    (type: string, value: string) => {
      // Create a new params object to avoid modifying the original
      const params = new URLSearchParams(searchParams.toString());

      // Clear other filters when selecting a new one
      if (type === 'genre') {
        params.delete('host');
        params.delete('takeover');
        if (params.get('genre') === value) {
          params.delete('genre');
        } else {
          params.set('genre', value);
        }
      } else if (type === 'host') {
        params.delete('genre');
        params.delete('takeover');
        if (params.get('host') === value) {
          params.delete('host');
        } else {
          params.set('host', value);
        }
      } else if (type === 'takeover') {
        params.delete('genre');
        params.delete('host');
        if (params.get('takeover') === value) {
          params.delete('takeover');
        } else {
          params.set('takeover', value);
        }
      }

      // Update the URL with replace instead of push to avoid stacking history entries
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const updateSearch = useCallback(
    (term: string) => {
      router.replace(`${pathname}?${createQueryString('searchTerm', term || null)}`, {
        scroll: false,
      });
    },
    [createQueryString, router, pathname]
  );

  // Update URL when debounced search term changes
  useEffect(() => {
    updateSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, updateSearch]);

  const toggleNew = useCallback(() => {
    router.replace(
      `${pathname}?${createQueryString('isNew', searchParams.get('isNew') === 'true' ? null : 'true')}`,
      { scroll: false }
    );
  }, [createQueryString, router, pathname, searchParams]);

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const hasActiveFilters = selectedGenre || selectedHost || selectedTakeover || searchTerm || isNew;

  const filterContent = (
    <div className='space-y-6'>
      <div>
        <div className='flex justify-between items-center mb-4'>
          {hasActiveFilters && (
            <button onClick={clearFilters} className='text-sm text-foreground'>
              Clear all
            </button>
          )}
        </div>

        <div className='space-y-4'>
          {/* Search */}
          <div>
            <label htmlFor='search' className='block text-sm text-foreground mb-1'>
              Search
            </label>
            <input
              type='search'
              id='search'
              className='w-full rounded-none border border-gray-300 px-3 py-2 text-sm'
              placeholder='Search shows...'
              value={localSearchTerm}
              onChange={e => setLocalSearchTerm(e.target.value)}
            />
          </div>

          {/* New Shows Toggle */}
          <div>
            <button
              onClick={toggleNew}
              className={`w-full text-left px-3 py-2 rounded-none text-sm ${isNew ? 'bg-bronze-500 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              New Shows
            </button>
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <div>
              <h3 className='text-sm text-foreground mb-2'>Genres</h3>
              <div className='space-y-1'>
                {genres.map(genre => (
                  <button
                    key={genre.slug}
                    onClick={() => updateFilters('genre', genre.slug)}
                    className={`w-full text-left px-3 py-2 text-xs uppercase ${selectedGenre === genre.slug ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
                  >
                    {genre.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hosts */}
          {hosts.length > 0 && (
            <div>
              <h3 className='text-sm text-foreground mb-2'>Hosts</h3>
              <div className='space-y-1'>
                {hosts.map(host => (
                  <button
                    key={host.slug}
                    onClick={() => updateFilters('host', host.slug)}
                    className={`w-full text-left px-3 py-2 rounded-none text-sm ${selectedHost === host.slug ? 'bg-bronze-500 text-white' : 'hover:bg-gray-100'}`}
                  >
                    {host.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Takeovers */}
          {takeovers.length > 0 && (
            <div>
              <h3 className='text-sm text-foreground mb-2'>Takeovers</h3>
              <div className='space-y-1'>
                {takeovers.map(takeover => (
                  <button
                    key={takeover.slug}
                    onClick={() => updateFilters('takeover', takeover.slug)}
                    className={`w-full text-left px-3 py-2 rounded-none text-sm ${selectedTakeover === takeover.slug ? 'bg-bronze-500 text-white' : 'hover:bg-gray-100'}`}
                  >
                    {takeover.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Filter button for both desktop and mobile */}
      <button
        onClick={() => setIsOpen(true)}
        className='w-max h-fit flex items-center justify-center bg-bronze-500 text-white py-3 px-4 mb-4 text-sm gap-2'
      >
        <Filter className='size-4' />
        <span>Filters</span>
        {hasActiveFilters && (
          <span className='bg-white text-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium ml-2'>
            !
          </span>
        )}
      </button>

      {/* Filter panel */}
      {isOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end lg:items-center lg:justify-center'>
          <div
            className={`bg-background border border-black dark:border-white w-full lg:w-[400px] lg:max-h-[80vh] p-6 overflow-y-auto ${isClosing ? 'animate-slide-down lg:animate-fade-out' : 'animate-slide-up lg:animate-fade-in'}`}
          >
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-lg font-bold'>Filters</h2>
              <button onClick={closeFilter} className='p-1 rounded-full hover:bg-gray-100'>
                <X size={24} className='text-foreground' />
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      )}
    </>
  );
}
