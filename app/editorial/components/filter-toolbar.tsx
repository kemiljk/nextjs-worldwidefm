"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { FilterItem } from "@/lib/filter-types";

interface FilterToolbarProps {
  onFilterChange: (filter: string, subfilter?: string) => void;
  onSearchChange?: (term: string) => void;
  searchTerm?: string;
  activeFilter: string;
  selectedFilters: { [key: string]: string[] };
  availableFilters: {
    [key: string]: FilterItem[];
  };
}

export function FilterToolbar({ onFilterChange, onSearchChange, searchTerm = "", activeFilter, selectedFilters, availableFilters }: FilterToolbarProps) {
  // Handle filter category buttons (Article, Video)
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

  // Handle subfilter selection (individual category)
  const handleSubfilterClick = (filter: string, subfilter: string) => {
    onFilterChange(filter, subfilter);
  };

  // Determine if a subfilter is selected
  const isSubfilterSelected = (filter: string, id: string) => {
    if (filter === "categories") return selectedFilters.categories?.includes(id);
    if (filter === "article") return selectedFilters.article?.includes(id);
    if (filter === "video") return selectedFilters.video?.includes(id);
    return false;
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Search Bar */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search editorial..." className="pl-10 bg-background border-blue-900 dark:border-blue-50" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      )}

      {/* Main Filter Categories */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className={cn("border-blue-900 dark:border-blue-50", !activeFilter && "bg-blue-900 text-white dark:bg-blue-50 dark:text-blue-900")} onClick={() => onFilterChange("")}>
          All
        </Button>

        <Button variant="outline" className={cn("border-blue-900 dark:border-blue-50", activeFilter === "new" && "bg-blue-900 text-white dark:bg-blue-50 dark:text-blue-900")} onClick={handleNewClick}>
          New
        </Button>

        <Button variant="outline" className={cn("border-blue-900 dark:border-blue-50", activeFilter === "article" && "bg-blue-900 text-white dark:bg-blue-50 dark:text-blue-900")} onClick={() => handleCategoryClick("article")}>
          Articles {selectedFilters.article?.length > 0 && `(${selectedFilters.article.length})`}
        </Button>

        <Button variant="outline" className={cn("border-blue-900 dark:border-blue-50", activeFilter === "video" && "bg-blue-900 text-white dark:bg-blue-50 dark:text-blue-900")} onClick={() => handleCategoryClick("video")}>
          Videos {selectedFilters.video?.length > 0 && `(${selectedFilters.video.length})`}
        </Button>

        <Button variant="outline" className={cn("border-blue-900 dark:border-blue-50", activeFilter === "categories" && "bg-blue-900 text-white dark:bg-blue-50 dark:text-blue-900")} onClick={() => handleCategoryClick("categories")}>
          Categories {selectedFilters.categories?.length > 0 && `(${selectedFilters.categories.length})`}
        </Button>
      </div>

      {/* Subfilters (shown based on active filter) */}
      {activeFilter === "categories" && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-900/20 dark:border-blue-50/20">
          {availableFilters.categories?.map((item) => (
            <Button key={`categories-${item.id}`} variant="outline" size="sm" className={cn("border-blue-900/50 dark:border-blue-50/50", isSubfilterSelected("categories", item.id) && "bg-blue-900/10 dark:bg-blue-50/10 border-blue-900 dark:border-blue-50")} onClick={() => handleSubfilterClick("categories", item.id)}>
              {item.title}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
