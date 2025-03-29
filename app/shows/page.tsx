import { getMixcloudShows, getAllFilters } from "@/lib/actions";
import { PageHeader } from "@/components/shared/page-header";
// import { ShowsGrid } from "@/components/shows-grid";
// import { ShowsFilter } from "@/components/shows-filter";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function ShowsPage({
  searchParams,
}: {
  searchParams?: {
    genre?: string;
    host?: string;
    takeover?: string;
    searchTerm?: string;
    isNew?: string;
  };
}) {
  const [{ shows, total }, filters] = await Promise.all([
    getMixcloudShows({
      genre: searchParams?.genre,
      host: searchParams?.host,
      takeover: searchParams?.takeover,
      searchTerm: searchParams?.searchTerm,
      isNew: searchParams?.isNew === "true",
    }),
    getAllFilters(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Shows" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
        <aside>{/* <ShowsFilter genres={filters.genres} hosts={filters.hosts} takeovers={filters.takeovers} selectedGenre={searchParams?.genre} selectedHost={searchParams?.host} selectedTakeover={searchParams?.takeover} searchTerm={searchParams?.searchTerm} isNew={searchParams?.isNew === "true"} /> */}</aside>

        <main className="lg:col-span-3">
          <Suspense fallback={<div>Loading shows...</div>}>{/* <ShowsGrid shows={shows} /> */}</Suspense>
        </main>
      </div>
    </div>
  );
}
