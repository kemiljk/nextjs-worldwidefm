"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterItem as BaseFilterItem } from "@/lib/filter-types";

type FilterItem = BaseFilterItem;

interface ContentToolbarProps {
  onFilterChange: (filter: string, subfilter?: string) => void;
  availableFilters?: {
    [key: string]: FilterItem[];
  };
  filterConfig: {
    key: string;
    label: string;
    isDropdown?: boolean;
  }[];
  showNew?: boolean;
  bgColor?: string;
}

export function ContentToolbar({ onFilterChange, availableFilters, filterConfig, showNew = true, bgColor = "bg-background" }: ContentToolbarProps) {
  const [activeFilter, setActiveFilter] = useState<string>("");

  const handleFilterClick = (filter: string) => {
    // If clicking the same filter, clear it
    if (activeFilter === filter) {
      setActiveFilter("");
      onFilterChange("");
      return;
    }

    setActiveFilter(filter);
    onFilterChange(filter);
  };

  const handleDropdownChange = (value: string) => {
    setActiveFilter(value);
    onFilterChange(value);
  };

  return (
    <div className={`sticky top-16 z-10 ${bgColor} border-b border-bronze-700`}>
      <div className="flex h-14 items-center gap-4 overflow-x-auto pb-2">
        <Button variant="ghost" className={cn("h-8 shrink-0 hover:bg-bronze-400/10 hover:text-black dark:hover:text-white", !activeFilter && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterClick("")}>
          All
        </Button>

        {showNew && (
          <Button variant="ghost" className={cn("h-8 shrink-0 hover:bg-bronze-400/10 hover:text-black dark:hover:text-white", activeFilter === "new" && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterClick("new")}>
            New
          </Button>
        )}

        {filterConfig.map(({ key, label, isDropdown }) => {
          const items = availableFilters?.[key] || [];
          if (items.length === 0) return null;

          if (isDropdown) {
            return (
              <Select key={key} value={activeFilter || undefined} onValueChange={handleDropdownChange}>
                <SelectTrigger className="h-8 w-[180px] shrink-0">
                  <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={`${key}-${item.id}`} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          return items.map((item) => (
            <Button key={`${key}-${item.id}`} variant="ghost" className={cn("h-8 shrink-0 hover:bg-bronze-400/10 hover:text-black dark:hover:text-white", activeFilter === item.id && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterClick(item.id)}>
              {item.title}
            </Button>
          ));
        })}
      </div>
    </div>
  );
}
