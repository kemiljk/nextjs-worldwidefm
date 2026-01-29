'use client';

import { GenreDropdown } from '@/components/genre-dropdown';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { ShowCard } from '@/components/ui/show-card';
import { usePlausible } from 'next-plausible';
import { fetchShowsByGenre } from '@/lib/actions/genre-selector';
import { ShowsGridSkeleton } from '@/components/shows-grid-skeleton';

interface GenreSelectorProps {
  shows: any[]; // Episodes from Cosmic
  title?: string;
  randomShowsByGenre?: Record<string, any>; // Pre-selected random shows per genre (genre title -> show)
  allCanonicalGenres?: Array<{ id: string; slug: string; title: string }>; // All genres from Cosmic
}

// Helper function to extract genres from episodes
function getEpisodeGenres(episode: any): string[] {
  const genres = episode.genres || episode.enhanced_genres || episode.metadata?.genres || [];
  return genres
    .map((genre: any) => genre.title || genre.name)
    .filter(Boolean)
    .filter((name: string) => name.toLowerCase() !== 'worldwide fm');
}

const NOISE_TAGS = new Set([
  'worldwide fm',
  'show',
  'episode',
  'radio',
  'wwfm',
  'archive',
  'recorded',
  'live',
  'mix',
  'radio show',
  'guest mix',
  'recorded live',
]);

export default function GenreSelector({
  shows,
  title = 'LISTEN BY GENRE',
  randomShowsByGenre = {},
  allCanonicalGenres = [],
}: GenreSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedGenre = searchParams.get('genre');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [genreShows, setGenreShows] = useState<any[]>([]);
  const [isLoadingGenre, setIsLoadingGenre] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const genreCacheRef = useRef<Map<string, any[]>>(new Map());
  const plausible = usePlausible();

  // Get unique genres and their counts
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    shows.forEach(episode => {
      getEpisodeGenres(episode).forEach(genreName => {
        counts[genreName] = (counts[genreName] || 0) + 1;
      });
    });
    return counts;
  }, [shows]);

  // Sort genres by count and take top 10
  const topGenres = useMemo(() => {
    return Object.entries(genreCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([name]) => name)
      .filter(name => !NOISE_TAGS.has(name.toLowerCase()));
  }, [genreCounts]);

  // Get all unique genres for the dropdown
  // Use all canonical genres if provided, otherwise fall back to genres found in recent shows
  const allGenres = useMemo(() => {
    const titles =
      allCanonicalGenres.length > 0
        ? allCanonicalGenres.map(g => g.title)
        : Object.keys(genreCounts);

    return Array.from(new Set(titles))
      .filter(title => title && !NOISE_TAGS.has(title.toLowerCase()))
      .sort();
  }, [allCanonicalGenres, genreCounts]);

  // Create a stable map of genre title to ID for lookups
  const genreMap = useMemo(
    () => new Map(allCanonicalGenres.map(g => [g.title, g.id])),
    [allCanonicalGenres]
  );

  // Fetch shows when genre is selected
  useEffect(() => {
    if (!selectedGenre) {
      // Reset to default view (top genres)
      setGenreShows([]);
      setIsEmpty(false);
      setIsLoadingGenre(false);
      return;
    }

    const genreId = genreMap.get(selectedGenre);
    if (!genreId) {
      setGenreShows([]);
      setIsEmpty(false);
      setIsLoadingGenre(false);
      return;
    }

    // Immediately show loading and clear previous shows when genre changes
    setIsLoadingGenre(true);
    setGenreShows([]);
    setIsEmpty(false);

    // Check cache first
    const cached = genreCacheRef.current.get(genreId);
    if (cached) {
      // Still show loading briefly for better UX, then show cached data
      const timer = setTimeout(() => {
        setGenreShows(cached);
        setIsEmpty(false);
        setIsLoadingGenre(false);
      }, 100); // Brief delay to show loading state

      return () => clearTimeout(timer);
    }

    // Prevent duplicate requests
    let cancelled = false;

    fetchShowsByGenre(genreId, 10)
      .then(result => {
        if (!cancelled) {
          setGenreShows(result.shows);
          setIsEmpty(result.isEmpty);
          setIsLoadingGenre(false);
          // Cache the result
          if (result.shows.length > 0) {
            genreCacheRef.current.set(genreId, result.shows);
          }
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Error fetching genre shows:', error);
          setGenreShows([]);
          setIsEmpty(false);
          setIsLoadingGenre(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGenre, genreMap]);

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

  const handleGenreSelect = (genre: string | null) => {
    if (genre) {
      plausible('Genre Selected', {
        props: {
          genre: genre,
          source: 'genre_selector',
        },
      });
    }
    router.replace(`${pathname}?${createQueryString('genre', genre)}`, { scroll: false });
  };

  // Get shows based on selection or default to pre-selected random shows for top genres
  const displayedShows = useMemo(() => {
    if (selectedGenre) {
      return genreShows.slice(0, 10);
    }

    const uniqueShowMap = new Map<string, any>();
    const usedShowIds = new Set<string>();

    // Try to get one unique show for each top genre until we have 10
    for (const genre of topGenres) {
      if (uniqueShowMap.size >= 10) break;

      let show = randomShowsByGenre[genre];

      // If no preloaded random show or it's already used, try to find another one from recent shows
      if (!show || usedShowIds.has(show.id || show.slug)) {
        const genreShowsFromRecent = shows
          .filter(episode => getEpisodeGenres(episode).includes(genre))
          .sort((a, b) => {
            const dateA = new Date(a.metadata?.broadcast_date || a.created_at || 0).getTime();
            const dateB = new Date(b.metadata?.broadcast_date || b.created_at || 0).getTime();
            return dateB - dateA;
          });

        show = genreShowsFromRecent.find(s => !usedShowIds.has(s.id || s.slug));
      }

      if (show) {
        uniqueShowMap.set(genre, show);
        usedShowIds.add(show.id || show.slug);
      }
    }

    // If we still don't have 10 shows, fill with remaining recent shows that haven't been shown
    if (uniqueShowMap.size < 10) {
      for (const show of shows) {
        if (uniqueShowMap.size >= 10) break;
        if (!usedShowIds.has(show.id || show.slug)) {
          uniqueShowMap.set(`filler-${show.id || show.slug}`, show);
          usedShowIds.add(show.id || show.slug);
        }
      }
    }

    return Array.from(uniqueShowMap.values());
  }, [selectedGenre, genreShows, topGenres, randomShowsByGenre, shows]);

  return (
    <section className='relative w-full h-full overflow-visible px-5 mt-20'>
      <div className='flex items-end justify-between mb-4'>
        <div className='flex flex-col gap-2 '>
          <h2 className='text-h8 md:text-h7 font-bold tracking-tight'>{title}</h2>
          <div className='text-left relative'>
            {dropdownOpen && (
              <div
                className='fixed inset-0 z-50 bg-almostblack/30'
                onClick={() => setDropdownOpen(false)}
              />
            )}
            <GenreDropdown
              genres={allGenres}
              onSelect={handleGenreSelect}
              selectedGenre={selectedGenre}
            />
          </div>
        </div>
        <a
          href='/shows'
          className='font-mono text-m8 sm:text-m7 text-almostblack uppercase hover:underline transition-all'
        >
          SEE ALL &gt;
        </a>
      </div>

      {isLoadingGenre ? (
        <ShowsGridSkeleton count={10} />
      ) : isEmpty && selectedGenre ? (
        <div className='py-12 text-center'>
          <p className='text-m7 text-almostblack dark:text-white'>
            No shows found for this genre yet.
          </p>
        </div>
      ) : (
        <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
          {displayedShows.map((episode: any, index: number) => (
            <div
              key={`${episode.id || episode.slug}-${index}`}
              className={`
            flex
            ${index >= 4 ? 'hidden md:flex' : ''}  /* show first 4 on mobile, reveal 4+ on desktop */
          `}
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
