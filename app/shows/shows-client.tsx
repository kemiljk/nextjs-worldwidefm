"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsGrid } from "../../components/shows-grid";
import { Loader, X } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { getEpisodesForShows } from "@/lib/episode-service";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanonicalGenre } from "@/lib/get-canonical-genres";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { Button } from "@/components/ui/button";
import { AvailableFilters as AvailableFiltersType } from "@/lib/filter-types";

interface ShowsClientProps {
  canonicalGenres: CanonicalGenre[];
  availableFilters: AvailableFiltersType;
}

export default function ShowsClient({ canonicalGenres, availableFilters }: ShowsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [shows, setShows] = useState<any[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const { ref, inView } = useInView();
  const PAGE_SIZE = 20;

  // Parse filter params
  const genreParam = searchParams.get("genre") ?? undefined;
  const typeParam = searchParams.get("type") ?? undefined; // New type parameter for navigation
  const searchTerm = searchParams.get("searchTerm") ?? undefined;

  const selectedGenres = genreParam ? genreParam.split("|").filter(Boolean) : [];

  // Determine which filter type is active based on the type parameter
  const activeType = typeParam || "all";

  // Build params for getEpisodesForShows
  const episodeParams: any = {
    genre: selectedGenres.length > 0 ? selectedGenres : undefined,
    searchTerm,
    limit: PAGE_SIZE,
  };

  // Load initial data and whenever filters/search change
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMore(true);
    console.log("Fetching initial episodes with offset 0");
    getEpisodesForShows({ ...episodeParams, offset: 0 }).then((response) => {
      if (!isMounted) return;
      console.log("Initial fetch response:", response);
      setShows(response.shows);
      setHasNext(response.hasNext);
      setIsLoadingMore(false);
      setPage(1);
      console.log("Episodes after initial fetch:", response.shows.length);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreParam, typeParam, searchTerm]);

  // Infinite scroll: load more when sentinel is in view
  useEffect(() => {
    if (inView && hasNext && !isLoadingMore) {
      setIsLoadingMore(true);
      const nextOffset = page * PAGE_SIZE;
      console.log("Fetching more episodes with offset", nextOffset);
      getEpisodesForShows({ ...episodeParams, offset: nextOffset }).then((response) => {
        console.log("Fetch more response:", response);
        setShows((prev) => {
          const combined = [...prev, ...response.shows];
          console.log("Episodes after append:", combined.length);
          return combined;
        });
        setHasNext(response.hasNext);
        setIsLoadingMore(false);
        setPage((prev) => prev + 1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasNext, isLoadingMore, page, genreParam, typeParam, searchTerm]);

  // Map episode genres to canonical genres (by slug or title, case-insensitive)
  function mapShowToCanonicalGenres(show: any): string[] {
    const genres = show.genres || show.enhanced_genres || [];
    return canonicalGenres
      .filter((genre) =>
        genres.some((showGenre: any) => {
          const genreName = showGenre.title?.toLowerCase() || showGenre.slug?.toLowerCase() || showGenre.name?.toLowerCase() || "";
          return genre.slug.toLowerCase() === genreName || genre.title.toLowerCase() === genreName;
        })
      )
      .map((genre) => genre.slug);
  }

  // Map episode hosts to available hosts (by name or slug, case-insensitive)
  function mapShowToAvailableHosts(show: any): string[] {
    const hosts = show.hosts || show.enhanced_hosts || show.regular_hosts || [];
    return availableFilters.hosts
      .filter((availableHost) =>
        hosts.some((showHost: any) => {
          const showHostName = showHost.name?.toLowerCase() || showHost.title?.toLowerCase() || "";
          const showHostSlug = showHost.username?.toLowerCase() || showHost.slug?.toLowerCase() || "";
          const availableHostTitle = availableHost.title.toLowerCase();
          const availableHostSlug = availableHost.slug.toLowerCase();
          return showHostName === availableHostTitle || showHostSlug === availableHostSlug || showHostName.includes(availableHostTitle) || availableHostTitle.includes(showHostName);
        })
      )
      .map((host) => host.slug);
  }

  // Check if show matches the selected type filter
  function matchesTypeFilter(show: any): boolean {
    switch (activeType) {
      case "regular-hosts":
        // For regular hosts, check if the show has any hosts that match our available hosts
        const mappedHosts = mapShowToAvailableHosts(show);
        return mappedHosts.length > 0;

      case "takeovers":
        // For takeovers, check if this is an episode with takeover metadata
        const showTakeovers = show.takeovers || show.enhanced_takeovers || [];
        return showTakeovers.length > 0;

      case "featured-shows":
        // For featured shows, check if this is an episode with featured show metadata
        return show.featured_on_homepage === true;

      case "all":
      default:
        return true;
    }
  }

  // Handle navigation to different filter types
  const handleTypeNavigation = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (type === "all") {
      params.delete("type");
    } else {
      params.set("type", type);
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle genre dropdown selection changes
  const handleGenreSelectionChange = (values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (values.length === 0) {
      params.delete("genre");
    } else {
      params.set("genre", values.join("|"));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle clear individual genre chip
  const handleClearGenre = (genreSlug: string) => {
    const newGenres = selectedGenres.filter((g) => g !== genreSlug);
    const params = new URLSearchParams(searchParams.toString());

    if (newGenres.length === 0) {
      params.delete("genre");
    } else {
      params.set("genre", newGenres.join("|"));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Filter shows by selected filters
  const filteredShows = shows.filter((show) => {
    // Check type filter
    if (!matchesTypeFilter(show)) {
      return false;
    }

    // Check genres
    if (selectedGenres.length > 0) {
      const mappedGenres = mapShowToCanonicalGenres(show);
      const matchesGenre = mappedGenres.some((slug) => selectedGenres.includes(slug));
      if (!matchesGenre) return false;
    }

    return true;
  });

  const hasActiveFilters = selectedGenres.length > 0;

  return (
    <div className="mx-auto lg:px-4 py-16">
      <div className="flex flex-col gap-4 w-full">
        <div>
          <PageHeader title="Shows" />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-2">
          {/* Type Navigation Buttons */}
          <Button variant="outline" className={cn("border-almostblack dark:border-white", activeType === "all" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => handleTypeNavigation("all")}>
            All
          </Button>

          {/* Genres Dropdown */}
          <MultiSelectDropdown
            options={canonicalGenres.map((genre) => ({
              id: genre.slug,
              title: genre.title,
              slug: genre.slug,
            }))}
            selectedValues={selectedGenres}
            onSelectionChange={handleGenreSelectionChange}
            placeholder="Genres"
          />

          <Button variant="outline" className={cn("border-almostblack dark:border-white", activeType === "regular-hosts" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => handleTypeNavigation("regular-hosts")}>
            Regular Hosts
          </Button>

          <Button variant="outline" className={cn("border-almostblack dark:border-white", activeType === "takeovers" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => handleTypeNavigation("takeovers")}>
            Takeovers
          </Button>

          <Button variant="outline" className={cn("border-almostblack dark:border-white", activeType === "featured-shows" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => handleTypeNavigation("featured-shows")}>
            Featured Shows
          </Button>
        </div>

        {/* Active Genre Filter Chips */}
        {hasActiveFilters && (
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {selectedGenres.map((genreSlug, index) => {
              const genre = canonicalGenres.find((g) => g.slug === genreSlug);
              return (
                <Badge key={`genre-${genreSlug}-${index}`} variant="default" className="uppercase font-mono text-m6 cursor-pointer whitespace-nowrap bg-accent text-accent-foreground flex items-center gap-1">
                  {genre?.title || genreSlug}
                  <X
                    className="h-3 w-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearGenre(genreSlug);
                    }}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8 mt-8">
        <main className="lg:col-span-3">
          <ShowsGrid shows={filteredShows} sentinelRef={ref} />
          {isLoadingMore && (
            <div className="h-4 flex items-center justify-center mt-8">
              <Loader className="h-4 w-4 animate-spin" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
