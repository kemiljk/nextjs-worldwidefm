"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { PlayButton } from "@/components/play-button";
import { GenreDropdown } from "@/components/genre-dropdown";

interface GenreSelectorProps {
  shows: MixcloudShow[];
  title?: string;
}

export default function GenreSelector({ shows, title = "LISTEN BY GENRE" }: GenreSelectorProps) {
  // Get unique genres and their counts
  const genreCounts = shows.reduce((acc, show) => {
    show.tags.forEach((tag) => {
      acc[tag.name] = (acc[tag.name] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  // Sort genres by count and take top 4
  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([name]) => name);

  // Get all unique genres for the dropdown
  const allGenres = Object.keys(genreCounts).sort();

  // Get a random show for each genre
  const genreShows = topGenres.map((genre) => {
    const genreShows = shows.filter((show) => show.tags.some((tag) => tag.name === genre));
    return genreShows[Math.floor(Math.random() * genreShows.length)];
  });

  return (
    <section className="px-4 md:px-8 lg:px-24 py-16 border-t border-bronze-900 bg-bronze-500">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-medium text-bronze-50">{title}</h2>
        <GenreDropdown genres={allGenres} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {genreShows.map((show, index) => {
          if (!show) return null;

          const segments = show.key.split("/").filter(Boolean);
          const showPath = segments.join("/");
          const genre = topGenres[index];

          return (
            <Link key={show.key} href={`/shows/${showPath}`}>
              <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative aspect-square">
                    <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="absolute bottom-4 left-4 right-4">
                        <span className="text-xs font-medium text-bronze-100 bg-black/40 px-2 py-1 rounded-full">{genre}</span>
                        <h3 className="text-lg leading-tight font-medium text-white line-clamp-2 mt-2">{show.name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <PlayButton show={show} variant="secondary" size="sm" className="bg-bronze-500 hover:bg-bronze-600 text-white" />
                          <ChevronRight className="w-4 h-4 text-bronze-100" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
