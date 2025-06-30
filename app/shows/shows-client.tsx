"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsFilter } from "../../components/shows-filter";
import { ShowsGrid } from "../../components/shows-grid";
import { Loader } from "lucide-react";
import { mapShowsToSearchItems } from "@/lib/search/engine";
import type { SearchFilters, SearchItem, FilterItem, FilterCategory } from "@/lib/search/types";
import { useInView } from "react-intersection-observer";
import { getAllShows } from "@/lib/actions";

export default function ShowsClient() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<SearchItem[]>([]);
  const [filters, setFilters] = useState<Record<FilterCategory, FilterItem[]>>({ genres: [], hosts: [], takeovers: [], locations: [], types: [] });
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cosmicSkip, setCosmicSkip] = useState(0);
  const [mixcloudSkip, setMixcloudSkip] = useState(0);
  const [page, setPage] = useState(1);
  const { ref, inView } = useInView();

  // Parse search params into SearchFilters
  const genre = searchParams.get("genre") ?? undefined;
  const host = searchParams.get("host") ?? undefined;
  const takeover = searchParams.get("takeover") ?? undefined;
  const searchTerm = searchParams.get("searchTerm") ?? undefined;
  const isNew = searchParams.get("isNew") === "true";
  const contentType = searchParams.get("type") ?? undefined;

  // Build SearchFilters object
  const searchFilters: SearchFilters = {
    contentType: ["radio-shows"], // Always only radio shows
    genres: genre ? [genre] : undefined,
    hosts: host ? [host] : undefined,
    takeovers: takeover ? [takeover] : undefined,
    search: searchTerm,
    // Optionally add isNew or other custom filters if supported
  };

  // Load initial data and whenever filters/search/page change
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMore(true);
    getAllShows(0, 0, 20, searchFilters).then((response) => {
      if (!isMounted) return;
      // Normalize all shows to SearchItem
      setResults(mapShowsToSearchItems(response.shows));
      setHasMore(response.hasMore);
      setCosmicSkip(response.cosmicSkip);
      setMixcloudSkip(response.mixcloudSkip);
      setIsLoadingMore(false);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, host, takeover, searchTerm, isNew]);

  // Reset page to 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [genre, host, takeover, searchTerm, isNew, contentType]);

  // Infinite scroll: load more when sentinel is in view
  useEffect(() => {
    if (inView && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      getAllShows(cosmicSkip, mixcloudSkip, 20, searchFilters).then((response) => {
        // Normalize all shows to SearchItem
        setResults((prev) => [...prev, ...mapShowsToSearchItems(response.shows)]);
        setHasMore(response.hasMore);
        setCosmicSkip(response.cosmicSkip);
        setMixcloudSkip(response.mixcloudSkip);
        setIsLoadingMore(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasMore, isLoadingMore]);

  return (
    <div className="mx-auto lg:px-4 py-16">
      <div className="flex justify-between w-full gap-8">
        <PageHeader title="Shows" />
        <ShowsFilter genres={filters.genres} hosts={filters.hosts} takeovers={filters.takeovers} selectedGenre={genre} selectedHost={host} selectedTakeover={takeover} searchTerm={searchTerm} isNew={isNew} />
      </div>
      <div className="flex flex-col gap-8 mt-8">
        <main className="lg:col-span-3">
          <ShowsGrid shows={results} sentinelRef={ref} />
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
