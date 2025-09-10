"use client";

import { GenreDropdown } from "@/components/genre-dropdown";
import Marquee from "@/components/ui/marquee";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ShowCard } from "@/components/ui/show-card";

interface GenreSelectorProps {
  shows: any[]; // Episodes from Cosmic
  title?: string;
}

// Helper function to extract genres from episodes
function getEpisodeGenres(episode: any): string[] {
  const genres = episode.genres || episode.enhanced_genres || episode.metadata?.genres || [];
  return genres
    .map((genre: any) => genre.title || genre.name)
    .filter(Boolean)
    .filter((name: string) => name.toLowerCase() !== "worldwide fm");
}

export default function GenreSelector({ shows, title = "LISTEN BY GENRE" }: GenreSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedGenre = searchParams.get("genre");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get unique genres and their counts
  const genreCounts = shows.reduce(
    (acc, episode) => {
      getEpisodeGenres(episode).forEach((genreName) => {
        acc[genreName] = (acc[genreName] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort genres by count and take top 4 for initial view
  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([name]) => name);

  // Get all unique genres for the dropdown
  const allGenres = Object.keys(genreCounts).sort();

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
    router.replace(`${pathname}?${createQueryString("genre", genre)}`, { scroll: false });
  };

  // Get shows based on selection or default to random shows for top genres
  const displayedShows = selectedGenre
    ? Array.from(new Set(shows.filter((episode) => getEpisodeGenres(episode).includes(selectedGenre)).map((episode) => episode.id || episode.slug)))
      .map((id) => shows.find((episode) => (episode.id || episode.slug) === id))
      .filter(Boolean)
      .sort(() => Math.random() - 0.5)
    : topGenres
      .map((genre) => {
        const genreShows = shows.filter((episode) => getEpisodeGenres(episode).includes(genre));
        return genreShows[Math.floor(Math.random() * genreShows.length)];
      })
      .filter(Boolean);

  // Remove any duplicate shows that might occur across genres
  const maxItems = 8; // max items to display
  const uniqueShows = Array.from(new Set(displayedShows.map((episode) => episode.id || episode.slug)))
    .map((id) => displayedShows.find((episode) => (episode.id || episode.slug) === id))
    .filter(Boolean)
    .slice(0, maxItems);
    

  return (
    <section className="relative w-full h-full overflow-visible px-5 mt-20">
      <div className="flex items-end justify-between mb-4">
        <div className="flex flex-col gap-2 ">
          <h2 className="text-h8 md:text-h7 font-bold tracking-tight">{title}</h2>
          <div className='text-left relative'>
            {dropdownOpen && (
              <div
                className="fixed inset-0 z-50 bg-almostblack/30"
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
              href="/shows"
              className='font-mono text-m8 sm:text-m7 text-almostblack uppercase hover:underline transition-all'
            >
              SEE ALL &gt;
            </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full h-auto">
        {uniqueShows.map((episode: any, index: number) => (
          <div
            key={`${episode.id || episode.slug}-${index}`}
            className={`
            flex
            ${index >= 4 ? 'hidden md:flex' : ''} h-[40vh]  /* show first 4 on sm, reveal 4+ on md+ */
          `}
          >
            <ShowCard
              show={episode}
              slug={`/episode/${episode.slug}`}
              playable
              className="w-full flex-1 cursor-default"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
