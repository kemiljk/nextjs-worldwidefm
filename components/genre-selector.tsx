"use client";

import { MixcloudShow, filterWorldwideFMTags } from "@/lib/mixcloud-service";
import { GenreDropdown } from "@/components/genre-dropdown";
import Marquee from "@/components/ui/marquee";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ShowCard } from "@/components/ui/show-card";

interface GenreSelectorProps {
  shows: MixcloudShow[];
  title?: string;
}

export default function GenreSelector({ shows, title = "LISTEN BY GENRE" }: GenreSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedGenre = searchParams.get("genre");

  // Get unique genres and their counts
  const genreCounts = shows.reduce(
    (acc, show) => {
      filterWorldwideFMTags(show.tags).forEach((tag) => {
        acc[tag.name] = (acc[tag.name] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort genres by count and take top 4 for initial view
  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
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
  const displayedShows: MixcloudShow[] = selectedGenre
    ? Array.from(new Set(shows.filter((show) => filterWorldwideFMTags(show.tags).some((tag) => tag.name === selectedGenre)).map((show) => show.key)))
        .map((key) => shows.find((show) => show.key === key))
        .filter((show): show is MixcloudShow => show !== undefined)
        .sort(() => Math.random() - 0.5)
    : topGenres
        .map((genre) => {
          const genreShows = shows.filter((show) => filterWorldwideFMTags(show.tags).some((tag) => tag.name === genre));
          return genreShows[Math.floor(Math.random() * genreShows.length)];
        })
        .filter((show): show is MixcloudShow => show !== undefined);

  // Remove any duplicate shows that might occur across genres
  const uniqueShows = Array.from(new Set(displayedShows.map((show) => show.key)))
    .map((key) => displayedShows.find((show) => show.key === key))
    .filter((show): show is MixcloudShow => show !== undefined);

  return (
    <section className="px-5 py-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-h7 font-display uppercase font-normal text-almostblack">{title}</h2>
        <GenreDropdown genres={allGenres} onSelect={handleGenreSelect} selectedGenre={selectedGenre} />
      </div>
      <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24 h-full" speed="slow" pauseOnHover>
        <div className="grid grid-flow-col auto-cols-max h-full gap-4 grid-cols-[repeat(auto-fit,minmax(440px,1fr))]">
          {uniqueShows.map((show: MixcloudShow, index: number) => (
            <ShowCard key={`${show.key}-${index}`} show={show} slug={`/episode/${show.key}`} playable />
          ))}
        </div>
      </Marquee>
    </section>
  );
}
