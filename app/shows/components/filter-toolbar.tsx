"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { FilterItem } from "@/lib/filter-types";

interface FilterToolbarProps {
  onFilterChange: (filter: string, subfilter?: string) => void;
  onSearchChange: (term: string) => void;
  searchTerm: string;
  activeFilter: string;
  selectedFilters: { [key: string]: string[] };
  availableFilters: {
    [key: string]: FilterItem[];
  };
}

export function FilterToolbar({ onFilterChange, onSearchChange, searchTerm, activeFilter, selectedFilters, availableFilters }: FilterToolbarProps) {
  // Handle filter category buttons (Genres, Hosts, Takeovers)
  const handleCategoryClick = (filter: string) => {
    // If clicking the same filter, clear it
    if (activeFilter === filter && !Object.values(selectedFilters).some((arr) => arr.length > 0)) {
      onFilterChange("");
    } else {
      onFilterChange(filter);
    }
  };

  // Handle "New" filter button (acts as toggle)
  const handleNewClick = () => {
    if (activeFilter === "new") {
      onFilterChange("");
    } else {
      onFilterChange("new");
    }
  };

  // Handle subfilter selection (individual genre, host, takeover)
  const handleSubfilterClick = (filter: string, subfilter: string) => {
    onFilterChange(filter, subfilter);
  };

  // Determine if a subfilter is selected
  const isSubfilterSelected = (filter: string, slug: string) => {
    if (filter === "genres") return selectedFilters.genres.includes(slug);
    if (filter === "hosts") return selectedFilters.hosts.includes(slug);
    if (filter === "takeovers") return selectedFilters.takeovers.includes(slug);
    return false;
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input placeholder="Search shows..." className="pl-10 bg-background border-bronze-900 dark:border-bronze-50" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
      </div>

      {/* Main Filter Categories */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className={cn("border-bronze-900 dark:border-bronze-50", !activeFilter && "bg-bronze-900 text-white dark:bg-bronze-50 dark:text-bronze-900")} onClick={() => onFilterChange("")}>
          All
        </Button>

        <Button variant="outline" className={cn("border-bronze-900 dark:border-bronze-50", activeFilter === "new" && "bg-bronze-900 text-white dark:bg-bronze-50 dark:text-bronze-900")} onClick={handleNewClick}>
          New
        </Button>

        <Button variant="outline" className={cn("border-bronze-900 dark:border-bronze-50", activeFilter === "genres" && "bg-bronze-900 text-white dark:bg-bronze-50 dark:text-bronze-900")} onClick={() => handleCategoryClick("genres")}>
          Genres {selectedFilters.genres.length > 0 && `(${selectedFilters.genres.length})`}
        </Button>

        <Button variant="outline" className={cn("border-bronze-900 dark:border-bronze-50", activeFilter === "hosts" && "bg-bronze-900 text-white dark:bg-bronze-50 dark:text-bronze-900")} onClick={() => handleCategoryClick("hosts")}>
          Hosts {selectedFilters.hosts.length > 0 && `(${selectedFilters.hosts.length})`}
        </Button>

        <Button variant="outline" className={cn("border-bronze-900 dark:border-bronze-50", activeFilter === "takeovers" && "bg-bronze-900 text-white dark:bg-bronze-50 dark:text-bronze-900")} onClick={() => handleCategoryClick("takeovers")}>
          Takeovers {selectedFilters.takeovers.length > 0 && `(${selectedFilters.takeovers.length})`}
        </Button>
      </div>

      {/* Subfilters - Modified to show genres on all screens */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-bronze-900/20 dark:border-bronze-50/20">
        {/* Always show top genres regardless of active filter */}
        {(!activeFilter || activeFilter === "genres") &&
          availableFilters.genres?.slice(0, 12).map((item) => (
            <Button key={`genres-${item.slug}`} variant="outline" size="sm" className={cn("border-bronze-900/50 dark:border-bronze-50/50", isSubfilterSelected("genres", item.slug) && "bg-bronze-900/10 dark:bg-bronze-50/10 border-bronze-900 dark:border-bronze-50")} onClick={() => handleSubfilterClick("genres", item.slug)}>
              {item.title}
            </Button>
          ))}

        {/* Show all genres when genres filter is active */}
        {activeFilter === "genres" &&
          availableFilters.genres?.slice(12).map((item) => (
            <Button key={`genres-${item.slug}`} variant="outline" size="sm" className={cn("border-bronze-900/50 dark:border-bronze-50/50", isSubfilterSelected("genres", item.slug) && "bg-bronze-900/10 dark:bg-bronze-50/10 border-bronze-900 dark:border-bronze-50")} onClick={() => handleSubfilterClick("genres", item.slug)}>
              {item.title}
            </Button>
          ))}

        {/* Show hosts when hosts filter is active */}
        {activeFilter === "hosts" &&
          availableFilters.hosts?.map((item) => (
            <Button key={`hosts-${item.slug}`} variant="outline" size="sm" className={cn("border-bronze-900/50 dark:border-bronze-50/50", isSubfilterSelected("hosts", item.slug) && "bg-bronze-900/10 dark:bg-bronze-50/10 border-bronze-900 dark:border-bronze-50")} onClick={() => handleSubfilterClick("hosts", item.slug)}>
              {item.title}
            </Button>
          ))}

        {/* Show takeovers when takeovers filter is active */}
        {activeFilter === "takeovers" &&
          availableFilters.takeovers?.map((item) => (
            <Button key={`takeovers-${item.slug}`} variant="outline" size="sm" className={cn("border-bronze-900/50 dark:border-bronze-50/50", isSubfilterSelected("takeovers", item.slug) && "bg-bronze-900/10 dark:bg-bronze-50/10 border-bronze-900 dark:border-bronze-50")} onClick={() => handleSubfilterClick("takeovers", item.slug)}>
              {item.title}
            </Button>
          ))}
      </div>
    </div>
  );
}
