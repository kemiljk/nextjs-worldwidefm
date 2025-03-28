"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Music2, Newspaper, Calendar, Video } from "lucide-react";
import { useSearch, SearchResultType, SearchResult } from "@/lib/search-context";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<SearchResultType, { label: string; icon: React.ElementType; color: string }> = {
  "radio-shows": { label: "Radio Shows", icon: Music2, color: "text-orange-500" },
  posts: { label: "Posts", icon: Newspaper, color: "text-blue-500" },
  events: { label: "Events", icon: Calendar, color: "text-green-500" },
  videos: { label: "Videos", icon: Video, color: "text-red-500" },
  takovers: { label: "Takovers", icon: Calendar, color: "text-bronze-500" },
} as const;

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { searchTerm, setSearchTerm, results, availableFilters } = useSearch();
  const [selectedTypes, setSelectedTypes] = useState<SearchResultType[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [selectedTakovers, setSelectedTakovers] = useState<string[]>([]);
  const [activeType, setActiveType] = useState<SearchResultType | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Calculate counts for genres and locations
  const { genreCounts, locationCounts } = useMemo(() => {
    const genreCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};

    results.forEach((item) => {
      item.genres.forEach((genre) => {
        genreCounts[genre.slug] = (genreCounts[genre.slug] || 0) + 1;
      });
      item.locations.forEach((location) => {
        locationCounts[location.slug] = (locationCounts[location.slug] || 0) + 1;
      });
    });

    return { genreCounts, locationCounts };
  }, [results]);

  // Filter content based on search term and filters
  const filteredContent = useMemo(() => {
    return results.filter((item: SearchResult) => {
      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(item.type)) {
        return false;
      }

      // Genre filter
      if (selectedGenres.length > 0 && !item.genres.some((g) => selectedGenres.includes(g.slug))) {
        return false;
      }

      // Location filter
      if (selectedLocations.length > 0 && !item.locations.some((l) => selectedLocations.includes(l.slug))) {
        return false;
      }

      // Series filter
      if (selectedHosts.length > 0 && !item.hosts.some((h) => selectedHosts.includes(h.slug))) {
        return false;
      }

      if (selectedTakovers.length > 0 && !item.takovers.some((t) => selectedTakovers.includes(t.slug))) {
        return false;
      }

      // Text search
      if (searchTerm) {
        const searchRegex = new RegExp(searchTerm, "i");
        return searchRegex.test(item.title) || searchRegex.test(item.description || "") || searchRegex.test(item.excerpt || "");
      }

      return true;
    });
  }, [results, searchTerm, selectedTypes, selectedGenres, selectedLocations, selectedHosts, selectedTakovers]);

  const handleFilterClick = (filter: string) => {
    if (activeFilter === filter) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filter);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
        <div className="flex h-full overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r shrink-0 h-full overflow-y-auto">
            <div className="p-4 space-y-6">
              <div>
                <h3 className="font-medium mb-2">Content Type</h3>
                <div className="space-y-2">
                  {Object.entries(typeLabels).map(([type, { label, icon: Icon, color }]) => (
                    <Button key={type} variant="ghost" className={cn("flex items-center gap-2 px-3 py-1 text-sm", activeType === type && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => setActiveType(type as SearchResultType)}>
                      <Icon className="h-4 w-4" style={{ color }} />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {availableFilters.genres.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Genres</h3>
                  <div className="space-y-1">
                    {availableFilters.genres.map((genre) => (
                      <Button key={`filter-genre-${genre.slug}`} variant="ghost" className={cn("px-3 py-1 text-sm", activeFilter === genre.slug && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterClick(genre.slug)}>
                        {genre.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {availableFilters.locations.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Locations</h3>
                  <div className="space-y-1">
                    {availableFilters.locations.map((location) => (
                      <Button key={`filter-location-${location.slug}`} variant="ghost" className={cn("px-3 py-1 text-sm", activeFilter === location.slug && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterClick(location.slug)}>
                        {location.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            {/* Search header - fixed */}
            <div className="border-b p-4 flex items-center gap-4 bg-background">
              <div className="flex-1 flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input placeholder="Search shows, articles, events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-lg" />
              </div>
            </div>

            {/* Results grid - scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredContent.map((item) => (
                    <Link key={`${item.type}-${item.slug}`} href={`/${item.type}/${item.slug}`} onClick={() => onOpenChange(false)} className="group">
                      <div className="flex flex-col h-full">
                        <div className="relative aspect-square">
                          <Image src={item.image || "/image-placeholder.svg"} alt={item.title} fill className="object-cover rounded" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            {(() => {
                              const TypeIcon = typeLabels[item.type].icon;
                              return <TypeIcon className={cn("w-4 h-4", typeLabels[item.type].color)} />;
                            })()}
                            <span>{typeLabels[item.type].label}</span>
                            {item.date && (
                              <>
                                <span>•</span>
                                <span>{format(new Date(item.date), "MMM d, yyyy")}</span>
                              </>
                            )}
                          </div>
                          <h3 className="font-medium group-hover:text-primary transition-colors">{item.title}</h3>
                          {item.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.genres.slice(0, 3).map((genre) => (
                                <Badge key={`${item.slug}-${genre.slug}`} variant="outline" className="text-xs font-normal">
                                  {genre.title}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
