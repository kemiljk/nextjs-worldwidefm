"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search as SearchIcon } from "lucide-react";

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Search({ value, onChange, placeholder = "Search...", className }: SearchProps) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="absolute h-4 w-4 text-muted-foreground" />
      <Input type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="" />
    </div>
  );
}
