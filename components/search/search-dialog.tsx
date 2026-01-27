'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Search,
  Minus,
  Music2,
  Newspaper,
  Video,
  Loader,
  AlertCircle,
  MicVocal,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getAllPosts,
  getVideos,
  getTakeovers,
  getRegularHosts,
  searchEpisodes,
  getShowsFilters,
} from '@/lib/actions';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import type { ContentType } from '@/lib/search/types';
import { useDebounce } from '@/hooks/use-debounce';
import { useInView } from 'react-intersection-observer';
import { Combobox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  episodes: { label: 'Latest Shows', icon: Music2, color: 'text-foreground' },
  posts: { label: 'Editorial', icon: Newspaper, color: 'text-foreground' },
  videos: { label: 'Video', icon: Video, color: 'text-foreground' },
  takeovers: { label: 'Takeover', icon: MicVocal, color: 'text-foreground' },
  'hosts-series': { label: 'Hosts', icon: Users, color: 'text-foreground' },
};

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Reduced from 500ms for snappier feel
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<string[]>([
    'episodes',
    'posts',
    'videos',
    'takeovers',
    'hosts-series',
  ]); // Default all types available
  const [canonicalGenres, setCanonicalGenres] = useState<any[]>([]);
  const [availableFilters, setAvailableFilters] = useState<any>({
    genres: [],
    hosts: [],
    locations: [],
  });
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);

  // Clear all state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedGenres([]);
      setSelectedLocations([]);
      setSelectedHosts([]);
      setActiveFilters([]);
      setResults([]);
      setPage(1);
      setHasNext(true);
      setShowFilters(false);
    } else {
      // Ensure a clean fetch when reopening
      setPage(1);
      setHasNext(true);
    }
    onOpenChange(isOpen);
  };
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  // On mobile: showFilters = false means show results, true means show filters overlay.
  const [showFilters, setShowFilters] = useState(false);
  const { ref: observerTarget, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px',
  });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef<number>(0);
  const PAGE_SIZE = 20;

  // Lazy load filter data only when dialog opens (optimized - no type checking)
  useEffect(() => {
    if (!open || filtersLoaded) return;
    async function fetchFilters() {
      try {
        const [filtersData, genresData] = await Promise.all([
          getShowsFilters(),
          getCanonicalGenres(),
        ]);
        setAvailableFilters(filtersData);
        setCanonicalGenres(genresData);
        setFiltersLoaded(true);
      } catch (error) {
        console.warn('Error fetching filters:', error);
      }
    }
    fetchFilters();
  }, [open, filtersLoaded]);

  // Determine selected content type
  const selectedType = activeFilters.find(f => Object.keys(typeLabels).includes(f)) || 'episodes';

  // Fetch results for the selected type, filters, and search
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    // Show loading and clear old results
    setIsLoading(true);
    setResults([]);
    setPage(1);
    setHasNext(true);

    async function fetchResults() {
      // If search term is cleared (empty) and no filters, fetch default content immediately
      const hasSearchTerm = debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
      const hasFilters =
        selectedGenres.length > 0 || selectedLocations.length > 0 || selectedHosts.length > 0;

      // If search term is too short (1 char) and no filters, wait for more input
      if (
        debouncedSearchTerm &&
        debouncedSearchTerm.trim().length > 0 &&
        debouncedSearchTerm.trim().length < 2 &&
        !hasFilters
      ) {
        if (isMounted && currentRequestId === requestIdRef.current) {
          setResults([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        let res: any;
        let allResults: any[] = [];
        let apiHasNext = false;

        if (selectedType === 'episodes') {
          const searchParams: any = {
            limit: PAGE_SIZE,
            offset: 0,
          };

          if (hasSearchTerm) {
            searchParams.searchTerm = debouncedSearchTerm.trim();
          }

          if (selectedGenres.length > 0) {
            searchParams.genre = selectedGenres;
          }

          if (selectedLocations.length > 0) {
            searchParams.location = selectedLocations;
          }

          if (selectedHosts.length > 0) {
            searchParams.host = selectedHosts;
          }

          res = await searchEpisodes(searchParams);
          allResults = res?.shows || [];
          apiHasNext = res?.hasNext ?? allResults.length === PAGE_SIZE;
        } else if (selectedType === 'posts') {
          const searchParams: any = { limit: PAGE_SIZE, offset: 0 };
          if (hasSearchTerm) {
            searchParams.searchTerm = debouncedSearchTerm.trim();
          }
          res = await getAllPosts(searchParams);
          allResults = res?.posts || [];
          apiHasNext = res?.hasNext ?? allResults.length === PAGE_SIZE;
        } else if (selectedType === 'videos') {
          const searchParams: any = { limit: PAGE_SIZE, offset: 0 };
          if (hasSearchTerm) {
            searchParams.searchTerm = debouncedSearchTerm.trim();
          }
          res = await getVideos(searchParams);
          allResults = res?.videos || [];
          apiHasNext = res?.hasNext ?? allResults.length === PAGE_SIZE;
        } else if (selectedType === 'takeovers') {
          const searchParams: any = {
            limit: PAGE_SIZE,
            offset: 0,
          };
          if (hasSearchTerm) {
            searchParams.searchTerm = debouncedSearchTerm.trim();
          }
          if (selectedGenres.length > 0) {
            searchParams.genre = selectedGenres;
          }
          if (selectedLocations.length > 0) {
            searchParams.location = selectedLocations;
          }
          if (selectedHosts.length > 0) {
            searchParams.host = selectedHosts;
          }
          res = await getTakeovers(searchParams);
          allResults = res?.shows || [];
          apiHasNext = res?.hasNext ?? allResults.length === PAGE_SIZE;
        } else if (selectedType === 'hosts-series') {
          const searchParams: any = {
            limit: PAGE_SIZE,
            offset: 0,
          };
          if (hasSearchTerm) {
            searchParams.searchTerm = debouncedSearchTerm.trim();
          }
          if (selectedGenres.length > 0) {
            searchParams.genre = selectedGenres;
          }
          if (selectedLocations.length > 0) {
            searchParams.location = selectedLocations;
          }
          res = await getRegularHosts(searchParams);
          allResults = res?.shows || [];
          apiHasNext = res?.hasNext ?? allResults.length === PAGE_SIZE;
        }

        // Only update results if this is still the latest request
        if (isMounted && currentRequestId === requestIdRef.current) {
          setResults(allResults);
          setHasNext(apiHasNext);
        }
      } catch (error) {
        // Only log and update if this is still the latest request
        if (isMounted && currentRequestId === requestIdRef.current) {
          // Check if it's a timeout error
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('503');

          if (process.env.NODE_ENV === 'development') {
            console.warn('Error fetching search results:', error);
          }

          // If search was cleared and there's an error, still reset to empty results
          // This prevents getting stuck in loading state
          setResults([]);
          setHasNext(false);
          setIsLoading(false);
        }
      } finally {
        // Always ensure loading state is reset, even if there was an error
        if (isMounted && currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }

    // Always fetch results - either default episodes or filtered/search results
    fetchResults();

    setTimeout(() => searchInputRef.current?.focus(), 100);

    return () => {
      isMounted = false;
      requestIdRef.current += 1;
    };
  }, [
    open,
    selectedType,
    selectedGenres.join('|'),
    selectedLocations.join('|'),
    selectedHosts.join('|'),
    debouncedSearchTerm,
  ]);

  // Debug: Log when debouncedSearchTerm changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && open) {
      console.log('[SearchDialog] debouncedSearchTerm changed:', debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, open]);

  // Infinite scroll: load more when sentinel is in view
  useEffect(() => {
    if (inView && hasNext && !isLoadingMore) {
      // Add a small delay to prevent rapid API calls
      const timeoutId = setTimeout(() => {
        setIsLoadingMore(true);
        const nextOffset = page * PAGE_SIZE;

        async function fetchMore() {
          try {
            let res: any;
            if (selectedType === 'episodes') {
              const searchParams: any = {
                limit: PAGE_SIZE,
                offset: nextOffset,
              };
              if (debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2) {
                searchParams.searchTerm = debouncedSearchTerm.trim();
              }
              if (selectedGenres.length > 0) {
                searchParams.genre = selectedGenres;
              }
              if (selectedLocations.length > 0) {
                searchParams.location = selectedLocations;
              }
              if (selectedHosts.length > 0) {
                searchParams.host = selectedHosts;
              }
              res = await searchEpisodes(searchParams);
              setResults(prev => [...prev, ...(res?.shows || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'posts') {
              const searchParams = debouncedSearchTerm
                ? { searchTerm: debouncedSearchTerm, limit: PAGE_SIZE, offset: nextOffset }
                : { limit: PAGE_SIZE, offset: nextOffset };
              res = await getAllPosts(searchParams);
              setResults(prev => [...prev, ...(res?.posts || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'videos') {
              const searchParams = debouncedSearchTerm
                ? { searchTerm: debouncedSearchTerm, limit: PAGE_SIZE, offset: nextOffset }
                : { limit: PAGE_SIZE, offset: nextOffset };
              res = await getVideos(searchParams);
              setResults(prev => [...prev, ...(res?.videos || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'takeovers') {
              const searchParams: any = {
                limit: PAGE_SIZE,
                offset: nextOffset,
              };
              if (debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2) {
                searchParams.searchTerm = debouncedSearchTerm.trim();
              }
              if (selectedGenres.length > 0) {
                searchParams.genre = selectedGenres;
              }
              if (selectedLocations.length > 0) {
                searchParams.location = selectedLocations;
              }
              if (selectedHosts.length > 0) {
                searchParams.host = selectedHosts;
              }
              res = await getTakeovers(searchParams);
              setResults(prev => [...prev, ...(res?.shows || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'hosts-series') {
              const searchParams: any = {
                limit: PAGE_SIZE,
                offset: nextOffset,
              };
              if (debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2) {
                searchParams.searchTerm = debouncedSearchTerm.trim();
              }
              if (selectedGenres.length > 0) {
                searchParams.genre = selectedGenres;
              }
              if (selectedLocations.length > 0) {
                searchParams.location = selectedLocations;
              }
              res = await getRegularHosts(searchParams);
              const hosts = res?.shows || [];
              setResults(prev => [...prev, ...hosts]);
              setHasNext(res?.hasNext || false);
            }
            setPage(prev => prev + 1);
          } catch (error) {
            console.warn('Error loading more results:', error);
            setHasNext(false);
          } finally {
            setIsLoadingMore(false);
          }
        }

        fetchMore();
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [
    inView,
    hasNext,
    isLoadingMore,
    page,
    selectedType,
    selectedGenres.join('|'),
    selectedLocations.join('|'),
    selectedHosts.join('|'),
    debouncedSearchTerm,
  ]);

  // Filter toggle logic (content type only)
  const handleFilterToggle = (filter: { type: string; slug: string }) => {
    if (filter.type === 'types') {
      setActiveFilters(prev => {
        return prev.includes(filter.slug)
          ? prev.filter(f => f !== filter.slug)
          : [filter.slug, ...prev.filter(f => !Object.keys(typeLabels).includes(f))];
      });
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters([]);
    setSelectedGenres([]);
    setSelectedLocations([]);
    setSelectedHosts([]);
    setSearchTerm('');
    setPage(1);
    setResults([]);
    setHasNext(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-[90vw] h-[80vh] p-0 gap-0 overflow-hidden'>
        <div className='flex h-full overflow-hidden relative flex-col sm:flex-row'>
          {/* --- Mobile: Search bar always at top, toggle below it --- */}
          <div className='sm:hidden w-full z-40 bg-background border-b shrink-0'>
            {/* Search Input and Edit filters button always at top */}
            <form
              onSubmit={e => {
                e.preventDefault();
                // Search is automatic via debounce, no need to reset state here
              }}
              className='flex gap-2'
            >
              <div className='px-4 h-12 items-center flex flex-1'>
                <Search className='h-6 w-6 text-muted-foreground' />
                <Input
                  ref={searchInputRef}
                  placeholder='Search'
                  className='border-none pl-4 font-mono text-m8 uppercase bg-background focus-visible:ring-0 focus-visible:ring-offset-0'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {/* Edit filters button always visible on mobile, to right of input */}
                <div className='w-auto flex justify-left py-2 bg-background pr-4'>
                  {!showFilters ? (
                    <Button
                      variant='none'
                      size='icon'
                      className='border h-8 w-8 p-0 flex items-center justify-center rounded-none'
                      onClick={() => {
                        setShowFilters(true); // Show filters overlay
                      }}
                      type='button'
                      aria-label='Edit filters'
                    >
                      <SlidersHorizontal className='h-4 w-4' />
                    </Button>
                  ) : (
                    <Button
                      variant='none'
                      size='icon'
                      className='border h-8 w-8 p-0 flex items-center justify-center bg-almostblack text-white dark:bg-white dark:text-almostblack rounded-none'
                      onClick={() => {
                        // Apply filters: hide overlay and refresh results
                        setShowFilters(false);
                        setPage(1);
                        setResults([]);
                        setHasNext(true);
                        // Clear search term when applying filters to show filtered results
                        setSearchTerm('');
                      }}
                      type='button'
                      aria-label='Apply filters'
                    >
                      <SlidersHorizontal className='h-4 w-4' />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Main flex: Filters and Results (desktop: row, mobile: overlays below search bar) */}
          <div className='flex flex-1 w-full h-full relative overflow-hidden'>
            {/* Filters Section */}
            <div
              className={cn(
                'w-full md:w-[30%] lg:w-[25%] border-r bg-background relative inset-y-0 left-0 z-30 sm:relative sm:block transition-transform duration-200 ease-in-out',
                'sm:static absolute h-full',
                // On mobile: overlay left, show/hide with showFilters, always block on desktop
                showFilters ? 'translate-x-0' : '-translate-x-full',
                'sm:translate-x-0'
              )}
              style={{
                display:
                  typeof window !== 'undefined' && window.innerWidth >= 640
                    ? 'block'
                    : showFilters
                      ? 'block'
                      : 'none',
              }}
            >
              {/* On mobile, add top margin for search bar and toggle */}
              <div className={cn('flex flex-col h-full', 'sm:mt-0', 'mt-0')}>
                <div className='px-4 py-3 sm:border-b'>
                  <div className='flex h-4 items-center justify-between'>
                    <h3 className='font-mono uppercase text-m8'>Filters</h3>
                    <div className='flex items-center gap-2'>
                      {(activeFilters.length > 0 ||
                        selectedGenres.length > 0 ||
                        selectedLocations.length > 0 ||
                        selectedHosts.length > 0) && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='hidden sm:block rounded-full text-[12px]'
                          onClick={clearAllFilters}
                        >
                          Clear all
                        </Button>
                      )}
                      {(activeFilters.length > 0 ||
                        selectedGenres.length > 0 ||
                        selectedLocations.length > 0 ||
                        selectedHosts.length > 0) && (
                        <Button
                          variant='none'
                          size='icon'
                          className='sm:hidden'
                          onClick={clearAllFilters}
                        >
                          <Minus className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className='overflow-y-auto h-full bg-background hide-scrollbar'>
                  <div className='px-4 py-4 space-y-4'>
                    {/* Content Type Section */}
                    <div className='border-b border-almostblack dark:border-white pb-4'>
                      <div className='space-y-2'>
                        {availableTypes.map(type => {
                          const { label, icon: Icon } = typeLabels[type];
                          return (
                            <button
                              key={type}
                              onClick={() => handleFilterToggle({ type: 'types', slug: type })}
                              className={cn(
                                'uppercase font-mono gap-3 rounded-full flex items-center px-3 py-2 w-full',
                                activeFilters.includes(type)
                                  ? 'bg-accent text-accent-foreground'
                                  : 'hover:bg-accent/100 hover:text-white hover:cursor-pointer'
                              )}
                            >
                              <Icon className='h-4 w-4' />
                              <span className='text-m8 leading-none'>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Filter Dropdowns */}
                    {(selectedType === 'episodes' ||
                      selectedType === 'takeovers' ||
                      selectedType === 'hosts-series') && (
                      <div className='space-y-3'>
                        {canonicalGenres.length > 0 && (
                          <div>
                            <label className='block text-sm font-mono uppercase text-m8 mb-2'>
                              Genre
                            </label>
                            <Combobox
                              options={canonicalGenres.map(genre => ({
                                value: genre.id,
                                label: genre.title.toUpperCase(),
                              }))}
                              value={selectedGenres}
                              onValueChange={setSelectedGenres}
                              placeholder='Genres'
                              searchPlaceholder='Search genres...'
                              emptyMessage='No genres found.'
                              className='w-full'
                            />
                          </div>
                        )}
                        {availableFilters.locations && availableFilters.locations.length > 0 && (
                          <div>
                            <label className='block text-sm font-mono uppercase text-m8 mb-2'>
                              Location
                            </label>
                            <Combobox
                              options={availableFilters.locations.map((location: any) => ({
                                value: location.id,
                                label: location.title.toUpperCase(),
                              }))}
                              value={selectedLocations}
                              onValueChange={setSelectedLocations}
                              placeholder='Locations'
                              searchPlaceholder='Search locations...'
                              emptyMessage='No locations found.'
                              className='w-full'
                            />
                          </div>
                        )}
                        {(selectedType === 'episodes' || selectedType === 'takeovers') &&
                          availableFilters.hosts &&
                          availableFilters.hosts.length > 0 && (
                            <div>
                              <label className='block text-sm font-mono uppercase text-m8 mb-2'>
                                Hosts
                              </label>
                              <Combobox
                                options={availableFilters.hosts.map((host: any) => ({
                                  value: host.id,
                                  label: host.title.toUpperCase(),
                                }))}
                                value={selectedHosts}
                                onValueChange={setSelectedHosts}
                                placeholder='Hosts'
                                searchPlaceholder='Search hosts...'
                                emptyMessage='No hosts found.'
                                className='w-full'
                              />
                            </div>
                          )}
                      </div>
                    )}
                    {/* Selected Filters as Removable Badges */}
                    {(selectedGenres.length > 0 ||
                      selectedLocations.length > 0 ||
                      selectedHosts.length > 0) && (
                      <div className='pt-4 border-t border-almostblack/20 dark:border-white/20'>
                        <label className='block text-sm font-mono uppercase text-m8 mb-2'>
                          Active Filters
                        </label>
                        <div className='flex flex-wrap gap-2'>
                          {selectedGenres.map(genreId => {
                            const genre = canonicalGenres.find(g => g.id === genreId);
                            return genre ? (
                              <Badge
                                key={`genre-${genreId}`}
                                variant='secondary'
                                className='group flex items-center gap-1 pr-1 bg-almostblack text-white dark:bg-white dark:text-almostblack cursor-pointer hover:bg-almostblack/80 dark:hover:bg-white/80'
                                onClick={() =>
                                  setSelectedGenres(prev => prev.filter(id => id !== genreId))
                                }
                              >
                                <span className='text-m8 uppercase'>{genre.title}</span>
                                <X className='h-3 w-3 opacity-60 group-hover:opacity-100' />
                              </Badge>
                            ) : null;
                          })}
                          {selectedLocations.map(locationId => {
                            const location = availableFilters.locations?.find(
                              (l: any) => l.id === locationId
                            );
                            return location ? (
                              <Badge
                                key={`location-${locationId}`}
                                variant='secondary'
                                className='group flex items-center gap-1 pr-1 bg-almostblack text-white dark:bg-white dark:text-almostblack cursor-pointer hover:bg-almostblack/80 dark:hover:bg-white/80'
                                onClick={() =>
                                  setSelectedLocations(prev => prev.filter(id => id !== locationId))
                                }
                              >
                                <span className='text-m8 uppercase'>{location.title}</span>
                                <X className='h-3 w-3 opacity-60 group-hover:opacity-100' />
                              </Badge>
                            ) : null;
                          })}
                          {selectedHosts.map(hostId => {
                            const host = availableFilters.hosts?.find((h: any) => h.id === hostId);
                            return host ? (
                              <Badge
                                key={`host-${hostId}`}
                                variant='secondary'
                                className='group flex items-center gap-1 pr-1 bg-almostblack text-white dark:bg-white dark:text-almostblack cursor-pointer hover:bg-almostblack/80 dark:hover:bg-white/80'
                                onClick={() =>
                                  setSelectedHosts(prev => prev.filter(id => id !== hostId))
                                }
                              >
                                <span className='text-m8 uppercase'>{host.title}</span>
                                <X className='h-3 w-3 opacity-60 group-hover:opacity-100' />
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Section */}
            <div
              className={cn(
                'flex-1 w-full justify-left flex-col min-w-0 overflow-hidden transition-all duration-200',
                'sm:static absolute h-full left-0',
                // On mobile: hide results if showFilters is true, always show on desktop
                !showFilters ? 'translate-x-0' : 'translate-x-full',
                'sm:translate-x-0'
              )}
              style={{
                display:
                  typeof window !== 'undefined' && window.innerWidth >= 640
                    ? 'block'
                    : !showFilters
                      ? 'block'
                      : 'none',
              }}
            >
              {/* Desktop search bar (mobile: already at top) */}
              <div className='hidden sm:block border-b shrink-0 w-full z-10'>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    // Search is automatic via debounce, no need to reset state here
                  }}
                  className='flex gap-2'
                >
                  <div className='px-4 h-10 items-center flex flex-1'>
                    <Search className='h-4 w-4 text-muted-foreground' />
                    <Input
                      ref={searchInputRef}
                      placeholder='Search'
                      className='border-none pl-4 font-mono text-m8 uppercase focus-visible:ring-0'
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </form>
              </div>

              {/* Results Section */}
              <ScrollArea
                className='flex-1 w-full hide-scrollbar min-h-0 h-[calc(100%-2.5rem)]'
                ref={scrollAreaRef}
              >
                <div className='p-8 space-y-6 min-h-0'>
                  {results.length > 0 ? (
                    <>
                      {results.map((result, idx) => {
                        const TypeIcon =
                          typeLabels[selectedType as keyof typeof typeLabels]?.icon || Music2;
                        const typeLabel =
                          typeLabels[selectedType as keyof typeof typeLabels]?.label || 'Content';

                        let linkHref = '';
                        switch (selectedType) {
                          case 'episodes':
                            linkHref = `/episode/${result.slug}`;
                            break;
                          case 'posts':
                            linkHref = `/editorial/${result.slug}`;
                            break;
                          case 'videos':
                            linkHref = `/videos/${result.slug}`;
                            break;
                          case 'takeovers':
                            linkHref = `/takeovers/${result.slug}`;
                            break;
                          case 'hosts-series':
                            linkHref = `/hosts/${result.slug}`;
                            break;
                          default:
                            linkHref = `/episode/${result.slug}`;
                        }

                        const formattedDate =
                          result.metadata?.broadcast_date ||
                          result.metadata?.date ||
                          result.created_at
                            ? format(
                                new Date(
                                  result.metadata?.broadcast_date ||
                                    result.metadata?.date ||
                                    result.created_at
                                ),
                                'MMM d, yyyy'
                              )
                            : null;

                        const genres =
                          selectedType === 'episodes' &&
                          Array.isArray(result.metadata?.genres) &&
                          result.metadata.genres.length > 0
                            ? result.metadata.genres
                            : null;

                        const categories =
                          (selectedType === 'posts' || selectedType === 'videos') &&
                          Array.isArray(result.metadata?.categories) &&
                          result.metadata.categories.length > 0
                            ? result.metadata.categories
                            : null;

                        const hosts =
                          selectedType === 'takeovers' &&
                          Array.isArray(result.metadata?.hosts) &&
                          result.metadata.hosts.length > 0
                            ? result.metadata.hosts
                            : null;

                        return (
                          <Link
                            key={`${result.id}-${result.slug}-${idx}`}
                            href={linkHref}
                            onClick={() => onOpenChange(false)}
                            className='group block w-full'
                          >
                            {/* Mobile Layout: Stacked */}
                            <div className='flex sm:hidden flex-col w-full pb-4 gap-1'>
                              <div className='flex items-center justify-between'>
                                <div className='flex items-center gap-2 text-[10px] text-muted-foreground'>
                                  <TypeIcon className='w-3 h-3 text-foreground' />
                                  <span>{typeLabel}</span>
                                </div>
                                {formattedDate && (
                                  <span className='text-[10px] text-muted-foreground'>
                                    {formattedDate}
                                  </span>
                                )}
                              </div>
                              <h3 className='text-[16px] font-mono uppercase leading-tight'>
                                {result.title}
                              </h3>
                              {(genres || categories || hosts) && (
                                <div className='flex flex-row flex-wrap gap-1 mt-1'>
                                  {genres?.map((genre: any) => (
                                    <Badge
                                      key={genre.id}
                                      variant='outline'
                                      className='text-[10px] py-0 h-5 uppercase'
                                    >
                                      {genre.title}
                                    </Badge>
                                  ))}
                                  {categories?.map((category: any) => (
                                    <Badge
                                      key={category.id}
                                      variant='outline'
                                      className='text-[10px] py-0 h-5 uppercase'
                                    >
                                      {category.title}
                                    </Badge>
                                  ))}
                                  {hosts?.map((host: any) => (
                                    <Badge
                                      key={host.id}
                                      variant='outline'
                                      className='text-[10px] py-0 h-5 uppercase'
                                    >
                                      {host.title}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Desktop Layout: Original */}
                            <div className='hidden sm:flex flex-col w-full pb-6 gap-2'>
                              {/* Line 1: Type + Date */}
                              <div className='flex items-center justify-between'>
                                <div className='flex items-center gap-2 text-m8 text-muted-foreground'>
                                  <TypeIcon className='w-3 h-3 text-foreground' />
                                  <span>{typeLabel}</span>
                                </div>
                                {formattedDate && (
                                  <span className='text-m8 text-muted-foreground'>
                                    {formattedDate}
                                  </span>
                                )}
                              </div>
                              {/* Line 2: Title + Genres/Categories/Hosts */}
                              <div className='flex items-center justify-between gap-4'>
                                <h3 className='text-[16px] sm:text-[18px] font-mono uppercase flex-1 min-w-0'>
                                  {result.title}
                                </h3>
                                {(genres || categories || hosts) && (
                                  <div className='flex flex-row flex-wrap gap-1 shrink-0'>
                                    {genres?.map((genre: any) => (
                                      <Badge
                                        key={genre.id}
                                        variant='outline'
                                        className='text-m8 uppercase'
                                      >
                                        {genre.title}
                                      </Badge>
                                    ))}
                                    {categories?.map((category: any) => (
                                      <Badge
                                        key={category.id}
                                        variant='outline'
                                        className='text-m8 uppercase'
                                      >
                                        {category.title}
                                      </Badge>
                                    ))}
                                    {hosts?.map((host: any) => (
                                      <Badge
                                        key={host.id}
                                        variant='outline'
                                        className='text-m8 uppercase'
                                      >
                                        {host.title}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {idx < results.length - 1 && (
                              <div className='border-b border-default w-full' />
                            )}
                          </Link>
                        );
                      })}
                      {/* Sentinel for Intersection Observer infinite scroll */}
                      <div
                        ref={observerTarget}
                        className='h-8 w-full flex items-center justify-center py-4'
                      >
                        {isLoadingMore && <Loader className='h-4 w-4 animate-spin' />}
                      </div>
                    </>
                  ) : isLoading ? (
                    <div className='space-y-6'>
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className='flex flex-col w-full pb-6 gap-2'>
                          <div className='flex items-center justify-between'>
                            <Skeleton className='h-4 w-24' />
                            <Skeleton className='h-4 w-20' />
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <Skeleton className='h-6 w-3/4' />
                            <Skeleton className='h-5 w-16' />
                          </div>
                          {i < 4 && <div className='border-b border-default w-full mt-4' />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='flex flex-col items-center justify-center uppercase py-12 text-center'>
                      <AlertCircle className='h-6 w-6 mb-4 text-muted-foreground' />
                      <p className='text-muted-foreground font-mono text-m8'>No results found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
