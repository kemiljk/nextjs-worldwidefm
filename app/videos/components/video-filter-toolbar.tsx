"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface VideoCategory {
  id: string;
  title: string;
  slug: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  metadata: null;
}

interface VideoFilterToolbarProps {
  onFilterChange: (filter: string, subfilter?: string) => void;
  onSearchChange?: (term: string) => void;
  searchTerm?: string;
  activeFilter: string;
  selectedFilters: { [key: string]: string[] };
  availableCategories: VideoCategory[];
}

export function VideoFilterToolbar({ onFilterChange, onSearchChange, searchTerm = "", activeFilter, selectedFilters, availableCategories }: VideoFilterToolbarProps) {
  const handleCategoryClick = (filter: string) => {
    if (activeFilter === filter && !Object.values(selectedFilters).some((arr) => arr.length > 0)) {
      onFilterChange("");
    } else {
      onFilterChange(filter);
    }
  };

  const handleNewClick = () => {
    if (activeFilter === "new") {
      onFilterChange("");
    } else {
      onFilterChange("new");
    }
  };

  const handleSubfilterClick = (filter: string, subfilter: string) => {
    onFilterChange(filter, subfilter);
  };

  const isSubfilterSelected = (filter: string, slug: string) => {
    if (filter === "categories") return selectedFilters.categories?.includes(slug);
    return false;
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Search Bar */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search videos..." className="pl-10 bg-background border-almostblack dark:border-white" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      )}

      {/* Main Filter Categories */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className={cn("border-almostblack dark:border-white", !activeFilter && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => onFilterChange("")}>
          All
        </Button>

        <Button variant="outline" className={cn("border-almostblack dark:border-white", activeFilter === "new" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={handleNewClick}>
          New
        </Button>

        <Button variant="outline" className={cn("border-almostblack dark:border-white", activeFilter === "categories" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => handleCategoryClick("categories")}>
          Categories {selectedFilters.categories?.length > 0 && `(${selectedFilters.categories.length})`}
        </Button>
      </div>

      {/* Subfilters (shown based on active filter) */}
      {activeFilter === "categories" && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-almostblack/20 dark:border-white/20">
          {availableCategories?.map((category) => (
            <Button key={`categories-${category.id}`} variant="outline" size="sm" className={cn("border-almostblack/50 dark:border-white/50", isSubfilterSelected("categories", category.slug) && "bg-almostblack/10 dark:bg-white/10 border-almostblack dark:border-white")} onClick={() => handleSubfilterClick("categories", category.slug)}>
              {category.title}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
