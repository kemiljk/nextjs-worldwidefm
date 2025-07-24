"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MultiSelectOption {
  id: string;
  title: string;
  slug?: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
}

export function MultiSelectDropdown({ options, selectedValues, onSelectionChange, placeholder, className }: MultiSelectDropdownProps) {
  const handleToggleSelection = (value: string) => {
    const newSelection = selectedValues.includes(value) ? selectedValues.filter((v) => v !== value) : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  const displayText = selectedValues.length > 0 ? `${placeholder} (${selectedValues.length})` : placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("border-almostblack dark:border-white justify-between text-almostblack dark:text-white", selectedValues.length > 0 && "bg-almostblack text-white dark:bg-white dark:text-almostblack", className)}>
          {displayText}
          <ChevronDown className={cn("h-4 w-4", selectedValues.length > 0 ? "text-white dark:text-almostblack" : "opacity-50 text-almostblack dark:text-white")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto">
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.slug || option.title);
          return (
            <div key={option.id} className={cn("flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-almostblack/20 dark:hover:bg-white/20 rounded-none", isSelected && "bg-almostblack dark:bg-white hover:bg-almostblack/80 dark:hover:bg-white/80 text-white dark:text-almostblack")} onClick={() => handleToggleSelection(option.slug || option.title)}>
              <div className={cn("w-4 h-4 border rounded-none flex items-center justify-center", isSelected && "bg-almostblack dark:bg-white")}>{isSelected && <Check className="h-3 w-3 text-white dark:text-almostblack" />}</div>
              {option.title}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
