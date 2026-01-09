'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { ShowsGrid } from '../../components/shows-grid';
import { Loader, X } from 'lucide-react';
import { getEpisodesForShows } from '@/lib/episode-service';
import { getRegularHosts, getTakeovers } from '@/lib/actions';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CanonicalGenre } from '@/lib/get-canonical-genres';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { AvailableFilters as AvailableFiltersType } from '@/lib/filter-types';
import { ShowsGridSkeleton } from '@/components/shows-grid-skeleton';

interface ShowsClientProps {
  canonicalGenres: CanonicalGenre[];
  availableFilters: AvailableFiltersType;
  initialShows?: any[];
  initialHasNext?: boolean;
}

export default function ShowsClient({
  canonicalGenres,
  availableFilters,
  initialShows = [],
  initialHasNext = false,
}: ShowsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [shows, setShows] = useState<any[]>(initialShows);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const loadMoreSentinelRef = React.useRef<HTMLDivElement>(null);

  // Parse filter params
  const genreParam = searchParams.get('genre') ?? undefined;
  const locationParam = searchParams.get('location') ?? undefined;
  const typeParam = searchParams.get('type') ?? undefined; // New type parameter for host/takeover filtering
  const searchTerm = searchParams.get('searchTerm') ?? undefined;
  const letterParam = searchParams.get('letter') ?? undefined;

  const selectedGenres = useMemo(
    () => (genreParam ? genreParam.split('|').filter(Boolean) : []),
    [genreParam]
  );
  const selectedLocations = useMemo(
    () => (locationParam ? locationParam.split('|').filter(Boolean) : []),
    [locationParam]
  );

  // Determine which filter type is active based on the type parameter
  const activeType = typeParam || 'all';

  // Track if we need to fetch (has filters/search) vs use initial data
  const needsFetch = useMemo(() => {
    return (
      selectedGenres.length > 0 ||
      selectedLocations.length > 0 ||
      searchTerm !== undefined ||
      letterParam !== undefined ||
      activeType !== 'all'
    );
  }, [selectedGenres.length, selectedLocations.length, searchTerm, letterParam, activeType]);

  // Load data whenever filters/search change (skip initial load if we have initial data and no filters)
  useEffect(() => {
    // If we have initial data and no filters are active, reset to initial data and don't fetch
    if (initialShows.length > 0 && !needsFetch && activeType === 'all') {
      setShows(initialShows);
      setHasNext(initialHasNext);
      return;
    }

    let isMounted = true;
    setIsInitialLoading(true);
    setIsLoadingMore(true);

    // Add a small delay to prevent rapid API calls
    const timeoutId = setTimeout(
      async () => {
        try {
          let response;

          // Use different data sources based on the active type
          if (activeType === 'hosts-series') {
            // Fetch regular hosts objects with filters
            const hostParams: any = {
              limit: PAGE_SIZE,
              offset: 0,
            };

            // Only add filters if they're selected
            if (selectedGenres.length > 0) {
              hostParams.genre = selectedGenres;
            }

            if (selectedLocations.length > 0) {
              hostParams.location = selectedLocations;
            }

            if (letterParam) {
              hostParams.letter = letterParam;
            }

            response = await getRegularHosts(hostParams);
          } else if (activeType === 'takeovers') {
            // Fetch takeovers objects with filters
            const takeoverParams: any = {
              limit: PAGE_SIZE,
              offset: 0,
            };

            // Only add filters if they're selected
            if (selectedGenres.length > 0) {
              takeoverParams.genre = selectedGenres;
            }

            if (selectedLocations.length > 0) {
              takeoverParams.location = selectedLocations;
            }

            response = await getTakeovers(takeoverParams);
          } else {
            // Fetch episodes with filters
            const episodeParams: any = {
              searchTerm,
              limit: PAGE_SIZE,
              offset: 0,
            };

            // Only add filters if they're selected
            if (selectedGenres.length > 0) {
              episodeParams.genre = selectedGenres;
            }

            if (selectedLocations.length > 0) {
              episodeParams.location = selectedLocations;
            }

            response = await getEpisodesForShows(episodeParams);
          }

          if (!isMounted) return;

          // Transform episodes data using the same function as other components
          if (activeType === 'all' || activeType === 'episodes') {
            const shows = (response as any).shows || [];
            const transformedShows = shows.map((show: any) => {
              const transformed = transformShowToViewData(show);
              return {
                ...transformed,
                key: transformed.slug, // Add key for media player identification
              };
            });
            setShows(transformedShows);
          } else if (activeType === 'hosts-series') {
            // For hosts, add key property
            const shows = (response as any).shows || [];
            const transformedHosts = shows.map((host: any) => ({
              ...host,
              key: host.slug, // Add key for media player identification
            }));
            setShows(transformedHosts);
          } else if (activeType === 'takeovers') {
            // For takeovers, add key property
            const shows = (response as any).shows || [];
            const transformedTakeovers = shows.map((takeover: any) => ({
              ...takeover,
              key: takeover.slug, // Add key for media player identification
            }));
            setShows(transformedTakeovers);
          }

          const hasNext = Array.isArray(response) ? false : response.hasNext;
          setHasNext(hasNext);
          setIsLoadingMore(false);
          setIsInitialLoading(false);
          setPage(1);
        } catch (error) {
          console.error('Error fetching data:', error);
          setIsLoadingMore(false);
          setIsInitialLoading(false);
          // Don't clear existing shows on error, just show loading state
        }
      },
      needsFetch ? 300 : 0
    ); // Shorter delay when we have filters, instant for initial load

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [
    selectedGenres,
    selectedLocations,
    typeParam,
    searchTerm,
    letterParam,
    needsFetch,
    activeType,
    initialShows.length,
  ]);

  // Load more data function
  const loadMore = useCallback(async () => {
    if (!hasNext || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextOffset = page * PAGE_SIZE;

    try {
      let response;

      // Use different data sources based on the active type
      if (activeType === 'hosts-series') {
        // Fetch more regular hosts objects with filters
        const hostParams: any = {
          limit: PAGE_SIZE,
          offset: nextOffset,
        };

        // Only add filters if they're selected
        if (selectedGenres.length > 0) {
          hostParams.genre = selectedGenres;
        }

        if (selectedLocations.length > 0) {
          hostParams.location = selectedLocations;
        }

        if (letterParam) {
          hostParams.letter = letterParam;
        }

        response = await getRegularHosts(hostParams);
      } else if (activeType === 'takeovers') {
        // Fetch more takeovers objects with filters
        const takeoverParams: any = {
          limit: PAGE_SIZE,
          offset: nextOffset,
        };

        // Only add filters if they're selected
        if (selectedGenres.length > 0) {
          takeoverParams.genre = selectedGenres;
        }

        if (selectedLocations.length > 0) {
          takeoverParams.location = selectedLocations;
        }

        response = await getTakeovers(takeoverParams);
      } else {
        // Fetch more episodes with filters
        const episodeParams: any = {
          searchTerm,
          limit: PAGE_SIZE,
          offset: nextOffset,
        };

        // Only add filters if they're selected
        if (selectedGenres.length > 0) {
          episodeParams.genre = selectedGenres;
        }

        if (selectedLocations.length > 0) {
          episodeParams.location = selectedLocations;
        }

        response = await getEpisodesForShows(episodeParams);
      }

      setShows(prev => {
        const existing = new Set(prev.map(s => s.id || s.slug));
        const merged = [...prev];

        // Transform new shows using the same function as other components
        let newShows: any[] = [];
        if (activeType === 'all' || activeType === 'episodes') {
          const shows = (response as any).shows || [];
          newShows = shows.map((s: any) => {
            const transformed = transformShowToViewData(s);
            return {
              ...transformed,
              key: transformed.slug, // Add key for media player identification
            };
          });
        } else if (activeType === 'hosts-series') {
          const shows = (response as any).shows || [];
          newShows = shows.map((host: any) => ({
            ...host,
            key: host.slug, // Add key for media player identification
          }));
        } else if (activeType === 'takeovers') {
          const shows = (response as any).shows || [];
          newShows = shows.map((takeover: any) => ({
            ...takeover,
            key: takeover.slug, // Add key for media player identification
          }));
        }

        newShows.forEach((s: any) => {
          const key = s.id || s.slug;
          if (!existing.has(key)) {
            merged.push(s);
            existing.add(key);
          }
        });
        return merged;
      });
      setHasNext(response.hasNext);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Error loading more data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    activeType,
    hasNext,
    isLoadingMore,
    page,
    selectedGenres,
    selectedLocations,
    searchTerm,
    letterParam,
  ]);

  // Map episode genres to canonical genres (by slug or title, case-insensitive)
  function mapShowToCanonicalGenres(show: any): string[] {
    const genres = show.genres || show.enhanced_genres || [];
    return canonicalGenres
      .filter(genre =>
        genres.some((showGenre: any) => {
          const genreName =
            showGenre.title?.toLowerCase() ||
            showGenre.slug?.toLowerCase() ||
            showGenre.name?.toLowerCase() ||
            '';
          return genre.slug.toLowerCase() === genreName || genre.title.toLowerCase() === genreName;
        })
      )
      .map(genre => genre.slug);
  }

  // Map episode hosts to available hosts (by name or slug, case-insensitive)
  function mapShowToAvailableHosts(show: any): string[] {
    const hosts = show.hosts || show.enhanced_hosts || show.regular_hosts || [];
    return availableFilters.hosts
      .filter(availableHost =>
        hosts.some((showHost: any) => {
          const showHostName = showHost.name?.toLowerCase() || showHost.title?.toLowerCase() || '';
          const showHostSlug =
            showHost.username?.toLowerCase() || showHost.slug?.toLowerCase() || '';
          const availableHostTitle = availableHost.title.toLowerCase();
          const availableHostSlug = availableHost.slug.toLowerCase();
          return (
            showHostName === availableHostTitle ||
            showHostSlug === availableHostSlug ||
            showHostName.includes(availableHostTitle) ||
            availableHostTitle.includes(showHostName)
          );
        })
      )
      .map(host => host.slug);
  }

  // Map episode locations to available locations (by name or slug, case-insensitive)
  function mapShowToAvailableLocations(show: any): string[] {
    const locations = show.locations || [];
    return availableFilters.locations
      .filter(availableLocation =>
        locations.some((showLocation: any) => {
          const showLocationName =
            showLocation.name?.toLowerCase() || showLocation.title?.toLowerCase() || '';
          const showLocationSlug = showLocation.slug?.toLowerCase() || '';
          const availableLocationTitle = availableLocation.title.toLowerCase();
          const availableLocationSlug = availableLocation.slug.toLowerCase();
          return (
            showLocationName === availableLocationTitle ||
            showLocationSlug === availableLocationSlug
          );
        })
      )
      .map(location => location.slug);
  }

  // Handle navigation to different filter types
  const handleTypeNavigation = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (type === 'all') {
      params.delete('type');
    } else {
      params.set('type', type);
    }

    // Clear letter filter when switching away from hosts-series
    if (type !== 'hosts-series') {
      params.delete('letter');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle genre dropdown selection changes
  const handleGenreSelectionChange = (values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (values.length === 0) {
      params.delete('genre');
    } else {
      params.set('genre', values.join('|'));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle location dropdown selection changes
  const handleLocationSelectionChange = (values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (values.length === 0) {
      params.delete('location');
    } else {
      params.set('location', values.join('|'));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle clear individual genre chip
  const handleClearGenre = (genreId: string) => {
    const newGenres = selectedGenres.filter(g => g !== genreId);
    const params = new URLSearchParams(searchParams.toString());

    if (newGenres.length === 0) {
      params.delete('genre');
    } else {
      params.set('genre', newGenres.join('|'));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle clear individual location chip
  const handleClearLocation = (locationId: string) => {
    const newLocations = selectedLocations.filter(l => l !== locationId);
    const params = new URLSearchParams(searchParams.toString());

    if (newLocations.length === 0) {
      params.delete('location');
    } else {
      params.set('location', newLocations.join('|'));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle letter filter selection
  const handleLetterSelect = (letter: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (letterParam === letter) {
      params.delete('letter');
    } else {
      params.set('letter', letter);
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // IntersectionObserver for automatic infinite scroll on hosts-series tab
  useEffect(() => {
    if (activeType !== 'hosts-series' || !hasNext || isLoadingMore) {
      return;
    }

    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [activeType, hasNext, isLoadingMore, loadMore]);

  // No need for client-side filtering since we fetch the correct data based on type
  const filteredShows = shows || [];

  const hasActiveFilters = selectedGenres.length > 0 || selectedLocations.length > 0;

  return (
    <div className='w-full overflow-x-hidden'>
      <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
        {/* Hyperpop background */}
        <div className='absolute inset-0 bg-hyperpop' />

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
          <PageHeader title='Shows' />
        </div>
      </div>

      <div className='px-5 flex flex-col gap-1 w-full'>
        {/* Filter Controls */}
        <div className='flex flex-wrap gap-2 text-m7 pt-4 pb-2'>
          {/* Type Navigation Buttons */}
          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeType === 'all' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={() => handleTypeNavigation('all')}
          >
            Episodes
          </Button>

          {/* Show genre and location filters for all content types */}
          {/* Genres Dropdown */}
          <Combobox
            options={canonicalGenres.map(genre => ({
              value: genre.id,
              label: genre.title.toUpperCase(),
            }))}
            value={selectedGenres}
            onValueChange={handleGenreSelectionChange}
            placeholder='Genres'
            searchPlaceholder='Search genres...'
            emptyMessage='No genres found.'
            className='w-fit'
          />

          {/* Locations Dropdown */}
          <Combobox
            options={availableFilters.locations.map(location => ({
              value: location.id,
              label: location.title.toUpperCase(),
            }))}
            value={selectedLocations}
            onValueChange={handleLocationSelectionChange}
            placeholder='Locations'
            searchPlaceholder='Search locations...'
            emptyMessage='No locations found.'
            className='w-fit'
          />

          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeType === 'hosts-series' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={() => handleTypeNavigation('hosts-series')}
          >
            Hosts & Series
          </Button>

          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeType === 'takeovers' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={() => handleTypeNavigation('takeovers')}
          >
            Takeovers
          </Button>
        </div>

        {/* Alphabet Filter - Only visible for Hosts & Series */}
        {activeType === 'hosts-series' && (
          <div className='flex flex-wrap gap-2 text-m7 pt-2 pb-2 border-t border-almostblack/20'>
            {[
              '0',
              'A',
              'B',
              'C',
              'D',
              'E',
              'F',
              'G',
              'H',
              'I',
              'J',
              'K',
              'L',
              'M',
              'N',
              'O',
              'P',
              'Q',
              'R',
              'S',
              'T',
              'U',
              'V',
              'W',
              'X',
              'Y',
              'Z',
            ].map(letter => (
              <Button
                key={letter}
                variant='outline'
                size='sm'
                className={cn(
                  'border-almostblack dark:border-white h-8 w-8 p-0 font-mono',
                  letterParam === letter &&
                    'bg-almostblack text-white dark:bg-white dark:text-almostblack'
                )}
                onClick={() => handleLetterSelect(letter)}
              >
                {letter}
              </Button>
            ))}
          </div>
        )}

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className='w-full border-t border-almostblack flex gap-2 pt-4 pb-2 text-m7 overflow-x-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700'>
            {selectedGenres.map((genreId, index) => {
              const genre = canonicalGenres.find(g => g.id === genreId);
              return (
                <Badge
                  key={`genre-${genreId}-${index}`}
                  variant='default'
                  className='font-mono cursor-pointer border border-almostblack hover:bg-white whitespace-nowrap bg-white text-almostblack flex items-center gap-1'
                >
                  {genre?.title.toUpperCase() || genreId}
                  <X
                    className='h-3 w-3'
                    onClick={e => {
                      e.stopPropagation();
                      handleClearGenre(genreId);
                    }}
                  />
                </Badge>
              );
            })}
            {selectedLocations.map((locationId, index) => {
              const location = availableFilters.locations.find(l => l.id === locationId);
              return (
                <Badge
                  key={`location-${locationId}-${index}`}
                  variant='default'
                  className='uppercase font-mono border border-almostblack cursor-pointer hover:bg-white whitespace-nowrap bg-white text-almostblack flex items-center gap-1'
                >
                  {location?.title.toUpperCase() || locationId}
                  <X
                    className='h-3 w-3'
                    onClick={e => {
                      e.stopPropagation();
                      handleClearLocation(locationId);
                    }}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className='pt-2 w-full px-5 flex-col pb-20'>
        <main className=''>
          {isInitialLoading ? (
            <ShowsGridSkeleton count={20} />
          ) : filteredShows.length > 0 ? (
            <ShowsGrid
              shows={filteredShows}
              contentType={activeType as 'episodes' | 'hosts-series' | 'takeovers'}
              canonicalGenres={canonicalGenres}
            />
          ) : (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <div className='text-6xl mb-4'>🔍</div>
              <h3 className='text-xl font-semibold mb-2'>No results found</h3>
              <p className='text-gray-600 mb-4 max-w-md'>
                {hasActiveFilters
                  ? `No ${activeType === 'hosts-series' ? 'hosts' : activeType === 'takeovers' ? 'takeovers' : 'episodes'} found matching your current filters.`
                  : `No ${activeType === 'hosts-series' ? 'hosts' : activeType === 'takeovers' ? 'takeovers' : 'episodes'} available at the moment.`}
              </p>
              {hasActiveFilters && (
                <Button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('genre');
                    params.delete('location');
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                  }}
                  variant='outline'
                  className='border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack'
                >
                  Clear all filters
                </Button>
              )}
            </div>
          )}
        </main>

        {/* IntersectionObserver sentinel for automatic loading */}
        {activeType === 'hosts-series' && hasNext && (
          <div ref={loadMoreSentinelRef} className='h-1 w-full' />
        )}

        {/* Load More Button - fallback for manual loading */}
        {hasNext && (
          <div className='w-full flex items-center justify-center mt-8'>
            <Button
              onClick={loadMore}
              disabled={isLoadingMore}
              variant='outline'
              className='border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack'
            >
              {isLoadingMore ? (
                <>
                  <Loader className='h-4 w-4 animate-spin mr-2' />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
