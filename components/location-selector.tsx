'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronsUpDown } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { fetchShowsByLocation } from '@/lib/actions/location-selector';
import { ShowCard } from '@/components/ui/show-card';
import { ShowsGridSkeleton } from '@/components/shows-grid-skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// cmdk's default matching is fuzzy ("lon" finds Barcelona). Match what was typed instead,
// ranking names that start with it first. Only whole-word starts match, so "lon" finds London
// and "york" finds New York.
function matchLocation(value: string, search: string): number {
  const name = value.toLowerCase();
  const term = search.trim().toLowerCase();
  if (!term) return 1;
  if (name.startsWith(term)) return 3;
  if (name.split(/[\s,-]+/).some(word => word.startsWith(term))) return 2;
  return 0;
}

export interface LocationOption {
  id: string;
  title: string;
}

interface LocationSelectorProps {
  title?: string;
  /** Every location editors have created. */
  locations: LocationOption[];
  /** Locations known to have shows, offered as one-tap suggestions. */
  suggestedLocations?: LocationOption[];
}

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export default function LocationSelector({
  title = 'LISTEN BY LOCATION',
  locations,
  suggestedLocations = [],
}: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LocationOption | null>(null);
  const [shows, setShows] = useState<any[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const cache = useRef(new Map<string, any[]>());
  const plausible = usePlausible();

  const sortedLocations = useMemo(
    () =>
      [...locations]
        .filter(location => location.title)
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })),
    [locations]
  );

  useEffect(() => {
    if (!selected) return;
    const cached = cache.current.get(selected.id);
    if (cached) {
      setShows(cached);
      setState('ready');
      return;
    }

    let cancelled = false;
    setState('loading');
    setShows([]);
    fetchShowsByLocation(selected.id, 10)
      .then(result => {
        if (cancelled) return;
        if ('failed' in result && result.failed) {
          setState('error');
          return;
        }
        setShows(result.shows);
        setState(result.isEmpty ? 'empty' : 'ready');
        if (result.shows.length > 0) cache.current.set(selected.id, result.shows);
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const choose = (location: LocationOption) => {
    plausible('Location Selected', {
      props: { location: location.title, source: 'location_selector' },
    });
    setSelected(location);
    setOpen(false);
  };

  if (sortedLocations.length === 0) return null;

  return (
    <section className='relative w-full h-full overflow-visible px-5 mt-20'>
      <div className='flex items-end justify-between mb-4 gap-4'>
        <div className='flex flex-col gap-2'>
          <h2 className='text-h8 md:text-h7 font-bold tracking-tight'>{title}</h2>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type='button'
                role='combobox'
                aria-expanded={open}
                aria-label='Choose a location'
                className='flex h-10 w-auto min-w-48 items-center justify-between gap-3 border border-input bg-background px-3 py-2 font-mono text-m7 uppercase hover:bg-almostblack hover:text-white'
              >
                {selected ? selected.title : 'Select a location'}
                <ChevronsUpDown className='size-4 shrink-0 opacity-50' aria-hidden='true' />
              </button>
            </PopoverTrigger>
            <PopoverContent className='w-72 p-0' align='start'>
              <Command filter={matchLocation}>
                <CommandInput placeholder='SEARCH CITIES AND COUNTRIES' />
                <CommandList>
                  <CommandEmpty>No locations found.</CommandEmpty>
                  {sortedLocations.map(location => (
                    <CommandItem
                      key={location.id}
                      value={location.title}
                      onSelect={() => choose(location)}
                      className='cursor-pointer'
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4',
                          selected?.id === location.id ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden='true'
                      />
                      {location.title}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {selected ? (
          <Link
            href={`/shows?location=${encodeURIComponent(selected.id)}`}
            className='font-mono text-m8 sm:text-m7 text-almostblack dark:text-white uppercase hover:underline transition-all'
          >
            ALL SHOWS IN {selected.title} &gt;
          </Link>
        ) : (
          <Link
            href='/shows'
            className='font-mono text-m8 sm:text-m7 text-almostblack dark:text-white uppercase hover:underline transition-all'
          >
            SEE ALL &gt;
          </Link>
        )}
      </div>

      {state === 'idle' && (
        <div className='flex flex-wrap gap-2' data-testid='location-suggestions'>
          {suggestedLocations.map(location => (
            <button
              key={location.id}
              type='button'
              onClick={() => choose(location)}
              className='rounded-full border border-almostblack px-3 py-1 font-mono text-m8 uppercase hover:bg-almostblack hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-almostblack'
            >
              {location.title}
            </button>
          ))}
          {suggestedLocations.length === 0 && (
            <p className='text-m7 text-almostblack dark:text-white'>
              Choose a city or country to hear shows from there.
            </p>
          )}
        </div>
      )}

      {state === 'loading' && <ShowsGridSkeleton count={10} />}

      {state === 'empty' && (
        <p className='py-12 text-center text-m7 text-almostblack dark:text-white' role='status'>
          No archived shows from {selected?.title} yet.
        </p>
      )}

      {state === 'error' && (
        <p className='py-12 text-center text-m7 text-almostblack dark:text-white' role='alert'>
          We couldn&apos;t load shows for {selected?.title}. Please try again.
        </p>
      )}

      {state === 'ready' && (
        <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
          {shows.slice(0, 10).map((episode: any, index: number) => (
            <div
              key={`${episode.id || episode.slug}-${index}`}
              className={`flex ${index >= 4 ? 'hidden md:flex' : ''}`}
            >
              <ShowCard
                show={episode}
                slug={`/episode/${episode.slug}`}
                playable
                className='w-full h-auto cursor-default'
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
