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

interface ShowsClientProps {
  canonicalGenres: CanonicalGenre[];
}

export default function ShowsClient({ canonicalGenres }: ShowsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [shows, setShows] = useState<MixcloudShow[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const { ref, inView } = useInView();
  const PAGE_SIZE = 20;

  // Parse genre param as multi-select (pipe-separated)
  const genreParam = searchParams.get("genre") ?? undefined;
  const selectedGenres = genreParam ? genreParam.split("|").filter(Boolean) : [];
  const host = searchParams.get("host") ?? undefined;
  const searchTerm = searchParams.get("searchTerm") ?? undefined;
  const isNew = searchParams.get("isNew") === "true";

  // Build params for getMixcloudShows
  const mixcloudParams: any = {
    tag: selectedGenres.length > 0 ? selectedGenres.join("|") : undefined,
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
  }, [genreParam, host, searchTerm, isNew]);

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
  }, [inView, hasNext, isLoadingMore, page, genreParam, host, searchTerm, isNew]);

  // --- Genre chip logic ---
  // Use canonicalGenres for chips
  const allGenres = canonicalGenres;

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

  // Multi-select chip handler
  const handleGenreClick = (genre: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!genre) {
      params.delete("genre");
    } else {
      const current = new Set(selectedGenres);
      if (current.has(genre)) {
        current.delete(genre);
      } else {
        current.add(genre);
      }
      if (current.size === 0) {
        params.delete("genre");
      } else {
        params.set("genre", Array.from(current).join("|"));
      }
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Filter shows by selected canonical genres (if any)
  const filteredShows =
    selectedGenres.length === 0
      ? shows
      : shows.filter((show) => {
          const mapped = mapShowToCanonicalGenres(show);
          return mapped.some((slug) => selectedGenres.includes(slug));
        });

  return (
    <div className="mx-auto lg:px-4 py-16">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex justify-between w-full gap-8 items-center">
          <PageHeader title="Shows" />
        </div>
        {/* Genre chip picker */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
          <button type="button" onClick={() => handleGenreClick(null)}>
            <Badge variant={selectedGenres.length === 0 ? "default" : "outline"} className={cn("uppercase font-mono text-m6 cursor-pointer whitespace-nowrap", selectedGenres.length === 0 ? "bg-accent text-accent-foreground" : "hover:bg-accent/5")}>
              All
            </Badge>
          </button>
          {allGenres.map((g) => (
            <button key={g.slug} type="button" onClick={() => handleGenreClick(g.slug)}>
              <Badge variant={selectedGenres.includes(g.slug) ? "default" : "outline"} className={cn("uppercase font-mono text-m6 cursor-pointer whitespace-nowrap", selectedGenres.includes(g.slug) ? "bg-accent text-accent-foreground" : "hover:bg-accent/5")}>
                {g.title}
              </Badge>
            </button>
          ))}
        </div>
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
