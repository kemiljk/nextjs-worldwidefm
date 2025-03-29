import { getMixcloudShows, getAllFilters } from "@/lib/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsGrid } from "../components/shows-grid";
import { ShowsFilter } from "../components/shows-filter";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface SearchParamsType {
  genre?: string;
  host?: string;
  takeover?: string;
  searchTerm?: string;
  isNew?: string;
}

async function ShowsPageContent({ searchParams }: { searchParams: SearchParamsType }) {
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
        <aside>
          <ShowsFilter genres={filters.genres} hosts={filters.hosts} takeovers={filters.takeovers} selectedGenre={searchParams?.genre} selectedHost={searchParams?.host} selectedTakeover={searchParams?.takeover} searchTerm={searchParams?.searchTerm} isNew={searchParams?.isNew === "true"} />
        </aside>

        <main className="lg:col-span-3">
          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-gray-100 animate-pulse rounded-md aspect-video w-full"></div>
                ))}
              </div>
            }
          >
            <ShowsGrid shows={shows} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function ShowsPage({ searchParams = {} }: { searchParams?: SearchParamsType }) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="h-8 bg-gray-200 w-40 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
            <aside>
              <div className="space-y-6 animate-pulse">
                <div className="h-6 w-24 bg-gray-200 mb-4"></div>
                <div className="h-10 bg-gray-200 mb-2"></div>
                <div className="h-10 bg-gray-200 mb-4"></div>
                <div className="h-6 w-16 bg-gray-200 mb-2"></div>
                <div className="space-y-1">
                  <div className="h-8 bg-gray-200"></div>
                  <div className="h-8 bg-gray-200"></div>
                  <div className="h-8 bg-gray-200"></div>
                </div>
              </div>
            </aside>
            <main className="lg:col-span-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-gray-200 animate-pulse rounded-md aspect-video w-full"></div>
                ))}
              </div>
            </main>
          </div>
        </div>
      }
    >
      <ShowsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
