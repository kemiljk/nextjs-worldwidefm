"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallback } from "react";

interface GenreDropdownProps {
  genres: string[];
}

export function GenreDropdown({ genres }: GenreDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === null) {
        params.delete(name);
      } else {
        params.set(name, value);
      }

      return params.toString();
    },
    [searchParams]
  );

  const handleGenreSelect = (genre: string) => {
    router.push(`${pathname}?${createQueryString("genre", genre)}`, { scroll: false });
  };

  return (
    <Select onValueChange={handleGenreSelect}>
      <SelectTrigger className="w-[180px] bg-bronze-600 border-bronze-700 text-bronze-50">
        <SelectValue placeholder="Select genre" />
      </SelectTrigger>
      <SelectContent>
        {genres.map((genre) => (
          <SelectItem key={genre} value={genre}>
            {genre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
