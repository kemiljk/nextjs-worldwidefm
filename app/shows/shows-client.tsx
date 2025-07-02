"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsFilter } from "../../components/shows-filter";
import { ShowsGrid } from "../../components/shows-grid";
import { Loader } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { getMixcloudShows } from "@/lib/mixcloud-service";
import type { MixcloudShow } from "@/lib/mixcloud-service";

export default function ShowsClient() {
  const searchParams = useSearchParams();
  const [shows, setShows] = useState<MixcloudShow[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const { ref, inView } = useInView();
  const PAGE_SIZE = 20;

  // Parse search params into MixcloudShowsParams
  const genre = searchParams.get("genre") ?? undefined;
  const host = searchParams.get("host") ?? undefined;
  const searchTerm = searchParams.get("searchTerm") ?? undefined;
  const isNew = searchParams.get("isNew") === "true";
  // type param is ignored for now, as we only fetch radio shows

  // Build params for getMixcloudShows
  const mixcloudParams: any = {
    tag: genre,
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
  }, [genre, host, searchTerm, isNew]);

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
  }, [inView, hasNext, isLoadingMore, page, genre, host, searchTerm, isNew]);

  return (
    <div className="mx-auto lg:px-4 py-16">
      <div className="flex justify-between w-full gap-8">
        <PageHeader title="Shows" />
        <ShowsFilter genres={[]} hosts={[]} takeovers={[]} selectedGenre={genre} selectedHost={host} selectedTakeover={undefined} searchTerm={searchTerm} isNew={isNew} />
      </div>
      <div className="flex flex-col gap-8 mt-8">
        <main className="lg:col-span-3">
          <ShowsGrid shows={shows} sentinelRef={ref} />
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
