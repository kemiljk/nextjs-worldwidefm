"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterItem } from "@/lib/search-context";
import { Suspense } from "react";

interface ShowsFilterProps {
  genres: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  selectedGenre?: string;
  selectedHost?: string;
  selectedTakeover?: string;
  searchTerm?: string;
  isNew?: boolean;
}

function ShowsFilterContent({ genres, hosts, takeovers, selectedGenre, selectedHost, selectedTakeover, searchTerm, isNew }: ShowsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = (type: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    // Clear other filters when selecting a new one
    if (type === "genre") {
      params.delete("host");
      params.delete("takeover");
      if (params.get("genre") === value) {
        params.delete("genre");
      } else {
        params.set("genre", value);
      }
    } else if (type === "host") {
      params.delete("genre");
      params.delete("takeover");
      if (params.get("host") === value) {
        params.delete("host");
      } else {
        params.set("host", value);
      }
    } else if (type === "takeover") {
      params.delete("genre");
      params.delete("host");
      if (params.get("takeover") === value) {
        params.delete("takeover");
      } else {
        params.set("takeover", value);
      }
    }

    // Update the URL
    router.push(`?${params.toString()}`);
  };

  const updateSearch = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set("searchTerm", term);
    } else {
      params.delete("searchTerm");
    }
    router.push(`?${params.toString()}`);
  };

  const toggleNew = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("isNew") === "true") {
      params.delete("isNew");
    } else {
      params.set("isNew", "true");
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("/shows");
  };

  const hasActiveFilters = selectedGenre || selectedHost || selectedTakeover || searchTerm || isNew;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg ">Filters</h2>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-bronze-500 hover:text-bronze-600">
              Clear all
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm  text-gray-700 mb-1">
              Search
            </label>
            <input type="search" id="search" className="w-full rounded-none border border-gray-300 px-3 py-2 text-sm" placeholder="Search shows..." value={searchTerm || ""} onChange={(e) => updateSearch(e.target.value)} />
          </div>

          {/* New Shows Toggle */}
          <div>
            <button onClick={toggleNew} className={`w-full text-left px-3 py-2 rounded-none text-sm ${isNew ? "bg-bronze-500 text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200"}`}>
              New Shows
            </button>
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <div>
              <h3 className="text-sm  text-gray-700 mb-2">Genres</h3>
              <div className="space-y-1">
                {genres.map((genre) => (
                  <button key={genre.slug} onClick={() => updateFilters("genre", genre.slug)} className={`w-full text-left px-3 py-2 rounded-none text-sm ${selectedGenre === genre.slug ? "bg-bronze-500 text-white" : "hover:bg-gray-100"}`}>
                    {genre.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hosts */}
          {hosts.length > 0 && (
            <div>
              <h3 className="text-sm  text-gray-700 mb-2">Hosts</h3>
              <div className="space-y-1">
                {hosts.map((host) => (
                  <button key={host.slug} onClick={() => updateFilters("host", host.slug)} className={`w-full text-left px-3 py-2 rounded-none text-sm ${selectedHost === host.slug ? "bg-bronze-500 text-white" : "hover:bg-gray-100"}`}>
                    {host.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Takeovers */}
          {takeovers.length > 0 && (
            <div>
              <h3 className="text-sm  text-gray-700 mb-2">Takeovers</h3>
              <div className="space-y-1">
                {takeovers.map((takeover) => (
                  <button key={takeover.slug} onClick={() => updateFilters("takeover", takeover.slug)} className={`w-full text-left px-3 py-2 rounded-none text-sm ${selectedTakeover === takeover.slug ? "bg-bronze-500 text-white" : "hover:bg-gray-100"}`}>
                    {takeover.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export a component that wraps the content in a Suspense boundary
export function ShowsFilter(props: ShowsFilterProps) {
  return (
    <Suspense
      fallback={
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
      }
    >
      <ShowsFilterContent {...props} />
    </Suspense>
  );
}
