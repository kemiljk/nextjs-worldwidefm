"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { getMixcloudShows, getAllFilters } from "@/lib/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsFilter } from "../components/shows-filter";
import { ShowsGrid } from "../components/shows-grid";
import { Loader } from "lucide-react";

// Force dynamic mode to prevent the issue with ISR and repeated POST requests
export const dynamic = "force-dynamic";

interface SearchParamsType {
  genre?: string;
  host?: string;
  takeover?: string;
  searchTerm?: string;
  isNew?: string;
}

// Client component to handle filters and display, no data fetching here
export default function ShowsPage({ searchParams }: { searchParams: SearchParamsType }) {
  const [shows, setShows] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({ genres: [], hosts: [], takeovers: [] });
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Parse search params safely
  const genre = searchParams?.genre ?? undefined;
  const host = searchParams?.host ?? undefined;
  const takeover = searchParams?.takeover ?? undefined;
  const searchTerm = searchParams?.searchTerm ?? undefined;
  const isNew = searchParams?.isNew === "true";

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      const [{ shows: initialShows }, initialFilters] = await Promise.all([
        getMixcloudShows({
          genre,
          host,
          takeover,
          searchTerm,
          isNew,
          skip: 0,
          limit: 20,
        }),
        getAllFilters(),
      ]);
      setShows(initialShows);
      setFilters(initialFilters);
      setHasMore(initialShows.length === 20);
    };
    loadInitialData();
  }, [genre, host, takeover, searchTerm, isNew]);

  // Load more results when scrolling to bottom
  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextSkip = skip + 20;
      const { shows: newShows } = await getMixcloudShows({
        genre,
        host,
        takeover,
        searchTerm,
        isNew,
        skip: nextSkip,
        limit: 20,
      });

      if (newShows.length > 0) {
        setShows((prev) => [...prev, ...newShows]);
        setHasMore(newShows.length === 20);
        setSkip(nextSkip);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more shows:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  return (
    <div className="mx-auto lg:px-4 py-16">
      <div className="flex justify-between w-full">
        <PageHeader title="Shows" />
        <ShowsFilter genres={filters.genres} hosts={filters.hosts} takeovers={filters.takeovers} selectedGenre={genre} selectedHost={host} selectedTakeover={takeover} searchTerm={searchTerm} isNew={isNew} />
      </div>

      <div className="flex flex-col gap-8 mt-8">
        <main className="lg:col-span-3">
          <ShowsGrid shows={shows} />
          <div ref={observerTarget} className="h-4 flex items-center justify-center mt-8">
            {isLoadingMore && <Loader className="h-4 w-4 animate-spin" />}
          </div>
        </main>
      </div>
    </div>
  );
}
