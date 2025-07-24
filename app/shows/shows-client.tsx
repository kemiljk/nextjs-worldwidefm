"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsGrid } from "../../components/shows-grid";
import { Loader, X } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { getEpisodesForShows } from "@/lib/episode-service";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanonicalGenre } from "@/lib/get-canonical-genres";
import { Combobox } from "@/components/ui/combobox";
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
  const locationParam = searchParams.get("location") ?? undefined;
  const typeParam = searchParams.get("type") ?? undefined; // New type parameter for host/takeover filtering
  const searchTerm = searchParams.get("searchTerm") ?? undefined;

  const selectedGenres = useMemo(() => (genreParam ? genreParam.split("|").filter(Boolean) : []), [genreParam]);
  const selectedLocations = useMemo(() => (locationParam ? locationParam.split("|").filter(Boolean) : []), [locationParam]);

  // Determine which filter type is active based on the type parameter
  const activeType = typeParam || "all";

  // Load initial data and whenever filters/search change
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMore(true);

    // Add a small delay to prevent rapid API calls
    const timeoutId = setTimeout(() => {
      // Build params inside useEffect to get current filter values
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

      // Handle type-specific filtering at the backend level
      if (activeType === "takeovers") {
        // Filter for episodes that have takeovers
        episodeParams.takeover = "*"; // Use a wildcard to indicate we want episodes with any takeovers
      }

      getEpisodesForShows(episodeParams)
        .then((response) => {
          if (!isMounted) return;
          setShows(response.shows);
          setHasNext(response.hasNext);
          setIsLoadingMore(false);
          setPage(1);
        })
        .catch((error) => {
          console.error("Error fetching episodes:", error);
          setIsLoadingMore(false);
          // Don't clear existing shows on error, just show loading state
        });
    }, 300); // 300ms delay

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenres, selectedLocations, typeParam, searchTerm]);

  // Infinite scroll: load more when sentinel is in view
  useEffect(() => {
    if (inView && hasNext && !isLoadingMore) {
      // Add a small delay to prevent rapid API calls
      const timeoutId = setTimeout(() => {
        setIsLoadingMore(true);
        const nextOffset = page * PAGE_SIZE;

        // Build params for infinite scroll (same logic as initial fetch)
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

        // Handle type-specific filtering at the backend level
        if (activeType === "takeovers") {
          episodeParams.takeover = "*";
        }

        getEpisodesForShows(episodeParams)
          .then((response) => {
            setShows((prev) => [...prev, ...response.shows]);
            setHasNext(response.hasNext);
            setIsLoadingMore(false);
            setPage((prev) => prev + 1);
          })
          .catch((error) => {
            console.error("Error loading more episodes:", error);
            setIsLoadingMore(false);
            // Don't increment page on error to allow retry
          });
      }, 200); // 200ms delay for infinite scroll
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasNext, isLoadingMore, page, selectedGenres, selectedLocations, typeParam, searchTerm]);

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

  // Map episode locations to available locations (by name or slug, case-insensitive)
  function mapShowToAvailableLocations(show: any): string[] {
    const locations = show.locations || [];
    return availableFilters.locations
      .filter((availableLocation) =>
        locations.some((showLocation: any) => {
          const showLocationName = showLocation.name?.toLowerCase() || showLocation.title?.toLowerCase() || "";
          const showLocationSlug = showLocation.slug?.toLowerCase() || "";
          const availableLocationTitle = availableLocation.title.toLowerCase();
          const availableLocationSlug = availableLocation.slug.toLowerCase();
          return showLocationName === availableLocationTitle || showLocationSlug === availableLocationSlug;
        })
      )
      .map((location) => location.slug);
  }

  // Check if show matches the selected type filter
  function matchesTypeFilter(show: any): boolean {
    switch (activeType) {
      case "hosts-series":
        // For hosts & series, check if the show has any hosts that match our available hosts
        const mappedHosts = mapShowToAvailableHosts(show);
        return mappedHosts.length > 0;

      case "takeovers":
        // For takeovers, check if this is an episode with takeover metadata
        const showTakeovers = show.takeovers || show.enhanced_takeovers || [];
        return showTakeovers.length > 0;

      case "all":
      default:
        // For "all", always return true - show everything
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

  // Handle location dropdown selection changes
  const handleLocationSelectionChange = (values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (values.length === 0) {
      params.delete("location");
    } else {
      params.set("location", values.join("|"));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle clear individual genre chip
  const handleClearGenre = (genreId: string) => {
    const newGenres = selectedGenres.filter((g) => g !== genreId);
    const params = new URLSearchParams(searchParams.toString());

    if (newGenres.length === 0) {
      params.delete("genre");
    } else {
      params.set("genre", newGenres.join("|"));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle clear individual location chip
  const handleClearLocation = (locationId: string) => {
    const newLocations = selectedLocations.filter((l) => l !== locationId);
    const params = new URLSearchParams(searchParams.toString());

    if (newLocations.length === 0) {
      params.delete("location");
    } else {
      params.set("location", newLocations.join("|"));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Filter shows by type only (server handles genre/location filtering)
  const filteredShows = shows.filter((show) => {
    // Only check type filter - genres and locations are filtered server-side
    return matchesTypeFilter(show);
  });

  const hasActiveFilters = selectedGenres.length > 0 || selectedLocations.length > 0;

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

          <Button variant="outline" className={cn("border-almostblack dark:border-white", activeType === "hosts-series" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => handleTypeNavigation("hosts-series")}>
            Hosts & Series
          </Button>

          <Button variant="outline" className={cn("border-almostblack dark:border-white", activeType === "takeovers" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => handleTypeNavigation("takeovers")}>
            Takeovers
          </Button>

          {/* Genres Dropdown */}
          <Combobox
            options={canonicalGenres.map((genre) => ({
              value: genre.id,
              label: genre.title.toUpperCase(),
            }))}
            value={selectedGenres}
            onValueChange={handleGenreSelectionChange}
            placeholder="Genres"
            searchPlaceholder="Search genres..."
            emptyMessage="No genres found."
            className="w-fit"
          />

          {/* Locations Dropdown */}
          <Combobox
            options={availableFilters.locations.map((location) => ({
              value: location.id,
              label: location.title.toUpperCase(),
            }))}
            value={selectedLocations}
            onValueChange={handleLocationSelectionChange}
            placeholder="Locations"
            searchPlaceholder="Search locations..."
            emptyMessage="No locations found."
            className="w-fit"
          />
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {selectedGenres.map((genreId, index) => {
              const genre = canonicalGenres.find((g) => g.id === genreId);
              return (
                <Badge key={`genre-${genreId}-${index}`} variant="default" className="uppercase font-mono text-m6 cursor-pointer whitespace-nowrap bg-accent text-accent-foreground flex items-center gap-1">
                  {genre?.title.toUpperCase() || genreId}
                  <X
                    className="h-3 w-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearGenre(genreId);
                    }}
                  />
                </Badge>
              );
            })}
            {selectedLocations.map((locationId, index) => {
              const location = availableFilters.locations.find((l) => l.id === locationId);
              return (
                <Badge key={`location-${locationId}-${index}`} variant="default" className="uppercase font-mono text-m6 cursor-pointer whitespace-nowrap bg-accent text-accent-foreground flex items-center gap-1">
                  {location?.title.toUpperCase() || locationId}
                  <X
                    className="h-3 w-3"
                    onClick={(e) => {
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
