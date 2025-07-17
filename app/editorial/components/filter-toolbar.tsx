"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { FilterItem } from "@/lib/filter-types";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { Badge } from "@/components/ui/badge";

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
  // Handle "New" filter button (acts as toggle)
  const handleNewClick = () => {
    if (activeFilter === "new") {
      onFilterChange("");
    } else {
      onFilterChange("new");
    }
  };

  // Handle dropdown selection changes
  const handleSelectionChange = (filterType: string) => (values: string[]) => {
    const currentSelected = selectedFilters[filterType] || [];

    // Find what changed
    const added = values.filter((v) => !currentSelected.includes(v));
    const removed = currentSelected.filter((v) => !values.includes(v));

    // Handle additions
    added.forEach((value) => {
      onFilterChange(filterType, value);
    });

    // Handle removals
    removed.forEach((value) => {
      onFilterChange(filterType, value);
    });

    // If no items selected, clear all filters
    if (values.length === 0) {
      onFilterChange("");
    }
  };

  const handleClearFilter = (filterType: string, value?: string) => {
    if (filterType === "new") {
      onFilterChange("");
    } else if (value) {
      onFilterChange(filterType, value); // This will toggle the item
    }
  };

  // Get all active filter chips
  const getActiveChips = () => {
    const chips: Array<{ type: string; value: string; label: string }> = [];

    if (activeFilter === "new") {
      chips.push({ type: "new", value: "new", label: "New" });
    }

    // Add article filters
    if (selectedFilters.article?.length > 0) {
      selectedFilters.article.forEach((slug) => {
        const item = availableFilters.article?.find((f) => f.slug === slug);
        chips.push({
          type: "article",
          value: slug,
          label: item?.title || slug,
        });
      });
    }

    // Add video filters
    if (selectedFilters.video?.length > 0) {
      selectedFilters.video.forEach((slug) => {
        const item = availableFilters.video?.find((f) => f.slug === slug);
        chips.push({
          type: "video",
          value: slug,
          label: item?.title || slug,
        });
      });
    }

    // Add category filters
    if (selectedFilters.categories?.length > 0) {
      selectedFilters.categories.forEach((slug) => {
        const item = availableFilters.categories?.find((f) => f.slug === slug);
        chips.push({
          type: "categories",
          value: slug,
          label: item?.title || slug,
        });
      });
    }

    return chips;
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Search Bar */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search editorial..." className="pl-10 bg-background border-almostblack dark:border-white" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      )}

      {/* Main Filter Controls */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className={cn("border-almostblack dark:border-white", !activeFilter && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={() => onFilterChange("")}>
          All
        </Button>

        <Button variant="outline" className={cn("border-almostblack dark:border-white", activeFilter === "new" && "bg-almostblack text-white dark:bg-white dark:text-almostblack")} onClick={handleNewClick}>
          New
        </Button>

        <MultiSelectDropdown
          options={
            availableFilters.article?.map((item) => ({
              id: item.id,
              title: item.title,
              slug: item.slug,
            })) || []
          }
          selectedValues={selectedFilters.article || []}
          onSelectionChange={handleSelectionChange("article")}
          placeholder="Articles"
        />

        <MultiSelectDropdown
          options={
            availableFilters.video?.map((item) => ({
              id: item.id,
              title: item.title,
              slug: item.slug,
            })) || []
          }
          selectedValues={selectedFilters.video || []}
          onSelectionChange={handleSelectionChange("video")}
          placeholder="Videos"
        />

        <MultiSelectDropdown
          options={
            availableFilters.categories?.map((item) => ({
              id: item.id,
              title: item.title,
              slug: item.slug,
            })) || []
          }
          selectedValues={selectedFilters.categories || []}
          onSelectionChange={handleSelectionChange("categories")}
          placeholder="Categories"
        />
      </div>

      {/* Active Filter Chips */}
      {getActiveChips().length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
          {getActiveChips().map((chip, index) => (
            <Badge key={`${chip.type}-${chip.value}-${index}`} variant="default" className="uppercase font-mono text-m6 cursor-pointer whitespace-nowrap bg-accent text-accent-foreground flex items-center gap-1">
              {chip.label}
              <X
                className="h-3 w-3"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearFilter(chip.type, chip.value);
                }}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
