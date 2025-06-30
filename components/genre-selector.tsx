"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { MixcloudShow, filterWorldwideFMTags } from "@/lib/mixcloud-service";
import { PlayButton } from "@/components/play-button";
import { GenreDropdown } from "@/components/genre-dropdown";
import Marquee from "@/components/ui/marquee";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

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
      <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24" speed="slow" pauseOnHover>
        {uniqueShows.map((show: MixcloudShow, index: number) => {
          if (!show) return null;

          const segments = show.key.split("/").filter(Boolean);
          let showPath = segments.join("/");
          if (showPath.startsWith("worldwidefm/")) {
            showPath = showPath.replace(/^worldwidefm\//, "");
          }

          return (
            <Link key={`${show.key}-${index}`} href={`/episode/${showPath}`} className="flex-none w-[300px]">
              <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative aspect-square">
                    <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent">
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex flex-wrap gap-1 mb-2">
                          {filterWorldwideFMTags(show.tags).map((tag, tagIndex) => (
                            <span key={`${show.key}-${tag.name}-${tagIndex}`} className={cn("px-2 py-1 border border-white/50 rounded-full text-[9.5px] transition-colors uppercase", selectedGenre === tag.name ? "bg-bronze-500 text-white" : "bg-black/40 text-white")}>
                              {tag.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <h3 className="text-m5 font-mono font-normal text-white line-clamp-2 mt-2">{show.name}</h3>
                          <PlayButton show={show} variant="secondary" size="icon" className="bg-bronze-500 hover:bg-bronze-600 text-white shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </Marquee>
    </section>
  );
}
