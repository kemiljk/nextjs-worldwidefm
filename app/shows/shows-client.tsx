"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsGrid } from "../../components/shows-grid";
import { Loader, X } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { getMixcloudShows } from "@/lib/mixcloud-service";
import type { MixcloudShow } from "@/lib/mixcloud-service";
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
  const [shows, setShows] = useState<MixcloudShow[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const { ref, inView } = useInView();
  const PAGE_SIZE = 20;

  // Parse filter params as multi-select (pipe-separated)
  const genreParam = searchParams.get("genre") ?? undefined;
  const hostParam = searchParams.get("host") ?? undefined;
  const takeoverParam = searchParams.get("takeover") ?? undefined;
  const featuredShowParam = searchParams.get("featuredShow") ?? undefined;
  const seriesParam = searchParams.get("series") ?? undefined;

  const selectedGenres = genreParam ? genreParam.split("|").filter(Boolean) : [];
  const selectedHosts = hostParam ? hostParam.split("|").filter(Boolean) : [];
  const selectedTakeovers = takeoverParam ? takeoverParam.split("|").filter(Boolean) : [];
  const selectedFeaturedShows = featuredShowParam ? featuredShowParam.split("|").filter(Boolean) : [];
  const selectedSeries = seriesParam ? seriesParam.split("|").filter(Boolean) : [];

  const searchTerm = searchParams.get("searchTerm") ?? undefined;
  const isNew = searchParams.get("isNew") === "true";

  // Build params for getMixcloudShows
  // Convert host slugs to host titles for API filtering
  const hostTitles = selectedHosts.map((hostSlug) => {
    const host = availableFilters.hosts.find((h) => h.slug === hostSlug);
    return host ? host.title.toLowerCase() : hostSlug;
  });

  const mixcloudParams: any = {
    tag: selectedGenres.length > 0 ? selectedGenres.join("|") : undefined,
    host: hostTitles.length > 0 ? hostTitles.join("|") : undefined,
    searchTerm,
    isNew,
    limit: PAGE_SIZE,
  };

  // Load initial data and whenever filters/search change
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMore(true);
    console.log("Fetching initial shows with offset 0");
    getMixcloudShows({ ...mixcloudParams, offset: 0 }).then((response) => {
      if (!isMounted) return;
      console.log("Initial fetch response:", response);
      setShows(response.shows);
      setHasNext(response.hasNext);
      setIsLoadingMore(false);
      setPage(1);
      console.log("Shows after initial fetch:", response.shows.length);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreParam, hostParam, takeoverParam, featuredShowParam, seriesParam, searchTerm, isNew]);

  // Infinite scroll: load more when sentinel is in view
  useEffect(() => {
    if (inView && hasNext && !isLoadingMore) {
      setIsLoadingMore(true);
      const nextOffset = page * PAGE_SIZE;
      console.log("Fetching more shows with offset", nextOffset);
      getMixcloudShows({ ...mixcloudParams, offset: nextOffset }).then((response) => {
        console.log("Fetch more response:", response);
        setShows((prev) => {
          const combined = [...prev, ...response.shows];
          console.log("Shows after append:", combined.length);
          return combined;
        });
        setHasNext(response.hasNext);
        setIsLoadingMore(false);
        setPage((prev) => prev + 1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasNext, isLoadingMore, page, genreParam, hostParam, takeoverParam, featuredShowParam, seriesParam, searchTerm, isNew]);

  // Map Mixcloud show tags to canonical genres (by slug or title, case-insensitive)
  function mapShowToCanonicalGenres(show: MixcloudShow): string[] {
    const tags = show.tags || [];
    return canonicalGenres
      .filter((genre) =>
        tags.some((tag) => {
          const tagName = tag.name.toLowerCase();
          return genre.slug.toLowerCase() === tagName || genre.title.toLowerCase() === tagName;
        })
      )
      .map((genre) => genre.slug);
  }

  // Map Mixcloud show hosts to available hosts (by name or username, case-insensitive)
  function mapShowToAvailableHosts(show: MixcloudShow): string[] {
    const hosts = show.hosts || [];
    return availableFilters.hosts
      .filter((availableHost) =>
        hosts.some((showHost) => {
          const showHostName = showHost.name.toLowerCase();
          const showHostUsername = showHost.username.toLowerCase();
          const availableHostTitle = availableHost.title.toLowerCase();
          const availableHostSlug = availableHost.slug.toLowerCase();
          return showHostName === availableHostTitle || showHostUsername === availableHostSlug || showHostName.includes(availableHostTitle) || availableHostTitle.includes(showHostName);
        })
      )
      .map((host) => host.slug);
  }

  // For shows with Cosmic data (__source: "cosmic"), check if they match selected filters
  function matchesCosmicFilters(show: any): boolean {
    // If it's not from Cosmic, we can't check these filters
    if (show.__source !== "cosmic") {
      return true; // Don't filter out non-Cosmic shows based on Cosmic-only filters
    }

    // Check takeovers
    if (selectedTakeovers.length > 0) {
      const showTakeovers = show.metadata?.takeovers || [];
      const matchesTakeover = showTakeovers.some((takeover: any) => selectedTakeovers.includes(takeover.slug || takeover.id));
      if (!matchesTakeover) return false;
    }

    // Check featured shows
    if (selectedFeaturedShows.length > 0) {
      // For featured shows, we might need to check if the show is in the featured shows list
      // This might require additional logic depending on how featured shows are structured
      const showFeaturedShows = show.metadata?.featured_shows || [];
      const matchesFeaturedShow = showFeaturedShows.some((featuredShow: any) => selectedFeaturedShows.includes(featuredShow.slug || featuredShow.id));
      if (!matchesFeaturedShow) return false;
    }

    // Check series
    if (selectedSeries.length > 0) {
      const showSeries = show.metadata?.series || [];
      const matchesSeries = showSeries.some((series: any) => selectedSeries.includes(series.slug || series.id));
      if (!matchesSeries) return false;
    }

    return true;
  }

  // Handle dropdown selection changes
  const handleSelectionChange = (filterType: string) => (values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (values.length === 0) {
      params.delete(filterType);
    } else {
      params.set(filterType, values.join("|"));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle "New" filter button
  const handleNewClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isNew) {
      params.delete("isNew");
    } else {
      params.set("isNew", "true");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle clear all filters
  const handleClearAll = () => {
    router.replace(pathname, { scroll: false });
  };

  // Handle clear individual filter chip
  const handleClearFilter = (filterType: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (filterType === "isNew") {
      params.delete("isNew");
    } else {
      const currentValues = params.get(filterType)?.split("|").filter(Boolean) || [];
      const newValues = currentValues.filter((v) => v !== value);

      if (newValues.length === 0) {
        params.delete(filterType);
      } else {
        params.set(filterType, newValues.join("|"));
      }
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Get all active filter chips
  const getActiveChips = () => {
    const chips: Array<{ type: string; value: string; label: string }> = [];

    if (isNew) {
      chips.push({ type: "isNew", value: "new", label: "New" });
    }

    // Add genre chips
    selectedGenres.forEach((genreSlug) => {
      const genre = canonicalGenres.find((g) => g.slug === genreSlug);
      chips.push({
        type: "genre",
        value: genreSlug,
        label: genre?.title || genreSlug,
      });
    });

    // Add host chips
    selectedHosts.forEach((hostSlug) => {
      const host = availableFilters.hosts.find((h) => h.slug === hostSlug);
      chips.push({
        type: "host",
        value: hostSlug,
        label: host?.title || hostSlug,
      });
    });

    // Add takeover chips
    selectedTakeovers.forEach((takeoverSlug) => {
      const takeover = availableFilters.takeovers.find((t) => t.slug === takeoverSlug);
      chips.push({
        type: "takeover",
        value: takeoverSlug,
        label: takeover?.title || takeoverSlug,
      });
    });

    // Add featured show chips
    selectedFeaturedShows.forEach((featuredShowSlug) => {
      const featuredShow = availableFilters.featuredShows.find((f) => f.slug === featuredShowSlug);
      chips.push({
        type: "featuredShow",
        value: featuredShowSlug,
        label: featuredShow?.title || featuredShowSlug,
      });
    });

    // Add series chips
    selectedSeries.forEach((seriesSlug) => {
      const series = availableFilters.series.find((s) => s.slug === seriesSlug);
      chips.push({
        type: "series",
        value: seriesSlug,
        label: series?.title || seriesSlug,
      });
    });

    return chips;
  };

  // Filter shows by all selected filter types
  const filteredShows = shows.filter((show) => {
    // Check genres
    if (selectedGenres.length > 0) {
      const mappedGenres = mapShowToCanonicalGenres(show);
      const matchesGenre = mappedGenres.some((slug) => selectedGenres.includes(slug));
      if (!matchesGenre) return false;
    }

    // Check hosts
    if (selectedHosts.length > 0) {
      const mappedHosts = mapShowToAvailableHosts(show);
      const matchesHost = mappedHosts.some((slug) => selectedHosts.includes(slug));
      if (!matchesHost) return false;
    }

    // Check Cosmic-specific filters (takeovers, featured shows, series)
    if (!matchesCosmicFilters(show)) {
      return false;
    }

    return true;
  });

  const hasActiveFilters = getActiveChips().length > 0;

  return (
    <div className="mx-auto lg:px-4 py-16">
      <div className="flex flex-col gap-4 w-full">
        <div>
          <PageHeader title="Shows" />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className={cn("border-almostblack dark:border-white", !hasActiveFilters && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={handleClearAll}>
            All
          </Button>

          <Button variant="outline" className={cn("border-almostblack dark:border-white", isNew && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={handleNewClick}>
            New
          </Button>

          <MultiSelectDropdown
            options={canonicalGenres.map((genre) => ({
              id: genre.slug,
              title: genre.title,
              slug: genre.slug,
            }))}
            selectedValues={selectedGenres}
            onSelectionChange={handleSelectionChange("genre")}
            placeholder="Genres"
          />

          <MultiSelectDropdown
            options={availableFilters.hosts.map((host) => ({
              id: host.id,
              title: host.title,
              slug: host.slug,
            }))}
            selectedValues={selectedHosts}
            onSelectionChange={handleSelectionChange("host")}
            placeholder="Regular Hosts"
          />

          <MultiSelectDropdown
            options={availableFilters.takeovers.map((takeover) => ({
              id: takeover.id,
              title: takeover.title,
              slug: takeover.slug,
            }))}
            selectedValues={selectedTakeovers}
            onSelectionChange={handleSelectionChange("takeover")}
            placeholder="Takeovers"
          />

          <MultiSelectDropdown
            options={availableFilters.featuredShows.map((featuredShow) => ({
              id: featuredShow.id,
              title: featuredShow.title,
              slug: featuredShow.slug,
            }))}
            selectedValues={selectedFeaturedShows}
            onSelectionChange={handleSelectionChange("featuredShow")}
            placeholder="Featured Shows"
          />

          <MultiSelectDropdown
            options={availableFilters.series.map((series) => ({
              id: series.id,
              title: series.title,
              slug: series.slug,
            }))}
            selectedValues={selectedSeries}
            onSelectionChange={handleSelectionChange("series")}
            placeholder="Series"
          />
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {getActiveChips().map((chip, index) => (
              <Badge key={`${chip.type}-${chip.value}-${index}`} variant="default" className="uppercase font-mono text-m6 cursor-pointer whitespace-nowrap bg-accent text-accent-foreground flex items-center gap-1">
                {chip.label}
                <X
                  className="h-3 w-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearFilter(chip.type, chip.value);
                  }}
                />
              </Badge>
            ))}
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
