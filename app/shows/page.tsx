import { getMixcloudShows, getAllFilters } from "@/lib/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ShowsGrid } from "../components/shows-grid";
import { ShowsFilter } from "../components/shows-filter";

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
export default async function ShowsPage({ searchParams }: { searchParams: SearchParamsType }) {
  // Explicitly define the search params for better tracking
  const genre = searchParams?.genre;
  const host = searchParams?.host;
  const takeover = searchParams?.takeover;
  const searchTerm = searchParams?.searchTerm;
  const isNew = searchParams?.isNew === "true";

  // Single data fetch at the top level of the page
  const [{ shows }, filters] = await Promise.all([
    getMixcloudShows({
      genre,
      host,
      takeover,
      searchTerm,
      isNew,
    }),
    getAllFilters(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Shows" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
        <aside className="lg:block">
          <ShowsFilter genres={filters.genres} hosts={filters.hosts} takeovers={filters.takeovers} selectedGenre={genre} selectedHost={host} selectedTakeover={takeover} searchTerm={searchTerm} isNew={isNew} />
        </aside>

        <main className="lg:col-span-3">
          <ShowsGrid shows={shows} />
        </main>
      </div>
    </div>
  );
}
