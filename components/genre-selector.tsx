"use client";

import { GenreDropdown } from "@/components/genre-dropdown";
import Marquee from "@/components/ui/marquee";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
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
  const uniqueShows = Array.from(new Set(displayedShows.map((episode) => episode.id || episode.slug)))
    .map((id) => displayedShows.find((episode) => (episode.id || episode.slug) === id))
    .filter(Boolean);

  return (
    <section className="px-5 py-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">{title}</h2>
        <GenreDropdown genres={allGenres} onSelect={handleGenreSelect} selectedGenre={selectedGenre} />
      </div>
      <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24 h-full" speed="slow" pauseOnHover>
        <div className="grid grid-flow-col auto-cols-max h-full gap-4 grid-cols-[repeat(auto-fit,minmax(440px,1fr))]">
          {uniqueShows.map((episode: any, index: number) => (
            <ShowCard key={`${episode.id || episode.slug}-${index}`} show={episode} slug={`/episode/${episode.slug}`} playable />
          ))}
        </div>
      </Marquee>
    </section>
  );
}
