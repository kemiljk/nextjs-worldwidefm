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

  // Filter content based on search term and filters
  const filteredContent = useMemo(() => {
    return results.filter((item: SearchResult) => {
      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(item.type)) {
        return false;
      }

      // Genre filter
      if (selectedGenres.length > 0 && !item.genres.some((g) => selectedGenres.includes(g))) {
        return false;
      }

      // Location filter
      if (selectedLocations.length > 0 && !item.locations.some((l) => selectedLocations.includes(l))) {
        return false;
      }

      // Series filter
      if (selectedHosts.length > 0 && !item.hosts.some((h) => selectedHosts.includes(h))) {
        return false;
      }

      if (selectedTakovers.length > 0 && !item.takovers.some((t) => selectedTakovers.includes(t))) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0 bg-background overflow-hidden overflow-y-scroll">
        <div className="flex h-full">
          {/* Filters sidebar */}
          <div className="w-64 border-r p-4 space-y-6">
            <div className="sticky top-4">
              <h3 className="font-medium mb-2">Content Type</h3>
              <div className="space-y-2">
                {Object.entries(typeLabels).map(([type, { label, icon: Icon, color }]) => (
                  <button key={type} onClick={() => setSelectedTypes((prev) => (prev.includes(type as SearchResultType) ? prev.filter((t) => t !== type) : [...prev, type as SearchResultType]))} className={cn("flex items-center gap-2 w-full p-2 rounded-md transition-colors", selectedTypes.includes(type as SearchResultType) ? "bg-accent" : "hover:bg-accent/50")}>
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {availableFilters.genres.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Genres</h3>
                <div className="space-y-1">
                  {availableFilters.genres.map((genre) => (
                    <button key={genre} onClick={() => setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]))} className={cn("text-sm w-full text-left px-2 py-1 rounded-md transition-colors", selectedGenres.includes(genre) ? "bg-accent" : "hover:bg-accent/50")}>
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Similar sections for Locations and Series */}
            {availableFilters.locations.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Locations</h3>
                <div className="space-y-1">
                  {availableFilters.locations.map((location) => (
                    <button key={location} onClick={() => setSelectedLocations((prev) => (prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]))} className={cn("text-sm w-full text-left px-2 py-1 rounded-md transition-colors", selectedLocations.includes(location) ? "bg-accent" : "hover:bg-accent/50")}>
                      {location}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* {availableFilters.hosts.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Hosts</h3>
                <div className="space-y-1">
                  {availableFilters.hosts.map((host) => (
                    <button key={host} onClick={() => setSelectedHosts((prev) => (prev.includes(host) ? prev.filter((h) => h !== host) : [...prev, host]))} className={cn("text-sm w-full text-left px-2 py-1 rounded-md transition-colors", selectedHosts.includes(host) ? "bg-accent" : "hover:bg-accent/50")}>
                      {host}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableFilters.takovers.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Takovers</h3>
                <div className="space-y-1">
                  {availableFilters.takovers.map((takover) => (
                    <button key={takover} onClick={() => setSelectedTakovers((prev) => (prev.includes(takover) ? prev.filter((t) => t !== takover) : [...prev, takover]))} className={cn("text-sm w-full text-left px-2 py-1 rounded-md transition-colors", selectedTakovers.includes(takover) ? "bg-accent" : "hover:bg-accent/50")}>
                      {takover}
                    </button>
                  ))}
                </div>
              </div>
            )} */}
          </div>

          {/* Search and results */}
          <div className="flex-1 flex flex-col h-full">
            {/* Search header */}
            <div className="sticky top-0 border-b p-4 flex items-center gap-4 bg-background z-10">
              <div className="flex-1 flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input placeholder="Search shows, articles, events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-lg" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Results grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredContent.map((item) => (
                  <Link key={item.id} href={`/${item.type}/${item.slug}`} onClick={() => onOpenChange(false)} className="group">
                    <div className="flex flex-col h-full">
                      <div className="relative aspect-square">
                        <Image src={item.image || "/placeholder.svg"} alt={item.title} fill className="object-cover rounded-md" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
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
                              <Badge key={genre} variant="secondary" className="text-xs">
                                {genre}
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
      </DialogContent>
    </Dialog>
  );
}
