"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Music2, Newspaper, Calendar, Video, Loader, AlertCircle, FileQuestion, FolderSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WWFMSearchEngine } from "@/lib/search/engine";
import type { SearchItem, FilterItem, FilterCategory, ContentType, SearchFilters } from "@/lib/search/types";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FilterCategoryUI = "all" | "genres" | "locations" | "hosts" | "takeovers" | "type";

const typeLabels: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  "radio-shows": { label: "Radio Shows", icon: Music2, color: "text-foreground" },
  posts: { label: "Posts", icon: Newspaper, color: "text-foreground" },
  events: { label: "Events", icon: Calendar, color: "text-foreground" },
  videos: { label: "Videos", icon: Video, color: "text-foreground" },
  takeovers: { label: "Takeovers", icon: Calendar, color: "text-foreground" },
};

const searchEngine = new WWFMSearchEngine();

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [activeTab, setActiveTab] = useState<FilterCategoryUI>("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [availableFilters, setAvailableFilters] = useState<Record<FilterCategory, FilterItem[]>>({ genres: [], hosts: [], takeovers: [], locations: [], types: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build SearchFilters from activeFilters and searchTerm
  const buildSearchFilters = (): SearchFilters => {
    const filters: SearchFilters = {};
    if (searchTerm) filters.search = searchTerm;
    // Map activeFilters to canonical filter keys
    const typeFilters = activeFilters.filter((f) => Object.keys(typeLabels).includes(f));
    if (typeFilters.length > 0) filters.contentType = typeFilters as ContentType[];
    const genreFilters = availableFilters.genres.filter((g) => activeFilters.includes(g.slug)).map((g) => g.slug);
    if (genreFilters.length > 0) filters.genres = genreFilters;
    const hostFilters = availableFilters.hosts.filter((h) => activeFilters.includes(h.slug)).map((h) => h.slug);
    if (hostFilters.length > 0) filters.hosts = hostFilters;
    const takeoverFilters = availableFilters.takeovers.filter((t) => activeFilters.includes(t.slug)).map((t) => t.slug);
    if (takeoverFilters.length > 0) filters.takeovers = takeoverFilters;
    const locationFilters = availableFilters.locations.filter((l) => activeFilters.includes(l.slug)).map((l) => l.slug);
    if (locationFilters.length > 0) filters.locations = locationFilters;
    return filters;
  };

  // Initial load and whenever filters/search change
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setSkip(0);
    setHasMore(true);
    searchEngine.search(buildSearchFilters(), { page: 1, limit: 20 }).then((response) => {
      setResults(response.items);
      setAvailableFilters(response.availableFilters);
      setHasMore(response.hasMore);
      setIsLoading(false);
    });
    // Focus input on open
    setTimeout(() => searchInputRef.current?.focus(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeFilters, searchTerm]);

  // Infinite scroll
  useEffect(() => {
    if (!open) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true);
          const nextPage = Math.floor(results.length / 20) + 1;
          searchEngine.search(buildSearchFilters(), { page: nextPage, limit: 20 }).then((response) => {
            setResults((prev) => [...prev, ...response.items]);
            setHasMore(response.hasMore);
            setIsLoadingMore(false);
          });
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoadingMore, open, results.length]);

  // Filter toggle logic
  const handleFilterToggle = (filter: FilterItem) => {
    setActiveFilters((prev) => {
      if (filter.type === "types") {
        // Only one type filter at a time
        return prev.includes(filter.slug) ? prev.filter((f) => f !== filter.slug) : [filter.slug, ...prev.filter((f) => !Object.keys(typeLabels).includes(f))];
      } else {
        return prev.includes(filter.slug) ? prev.filter((f) => f !== filter.slug) : [...prev, filter.slug];
      }
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full overflow-hidden">
          {/* Mobile Filter Button */}
          <div className="sm:hidden absolute left-2 top-2 z-50">
            <Button variant="ghost" size="icon" onClick={clearAllFilters}>
              <FolderSearch className="h-5 w-5" />
            </Button>
          </div>

          {/* Filters Section */}
          <div className={cn("w-64 border-r bg-background", "fixed inset-y-0 left-0 z-50 sm:relative sm:block", "transition-transform duration-200 ease-in-out")}>
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Filters</h3>
                  <div className="flex items-center gap-2">
                    {activeFilters.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-6" onClick={clearAllFilters}>
                        Clear all
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="sm:hidden" onClick={clearAllFilters}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto h-full bg-background">
                <div className="p-4 space-y-4">
                  {/* Content Type Section */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Content Type</h4>
                    <div className="space-y-1">
                      {Object.entries(typeLabels).map(([type, { label, icon: Icon, color }]) => (
                        <button key={type} onClick={() => handleFilterToggle({ id: type, slug: type, title: label, type: "types" })} className={cn("flex items-center w-full px-2 py-1.5 text-sm", activeFilters.includes(type) ? "bg-accent" : "hover:bg-accent/5")}>
                          <Icon className={cn("h-4 w-4 mr-2", color)} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Genres Section */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Genres</h4>
                    <div className="space-y-1">
                      {availableFilters.genres.map((genre: FilterItem) => (
                        <button key={genre.slug} onClick={() => handleFilterToggle({ ...genre, type: "genres" })} className={cn("flex items-center w-full px-2 py-1.5 text-xs uppercase", activeFilters.includes(genre.slug) ? "bg-accent" : "hover:bg-accent/5")}>
                          {genre.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Hosts Section */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Hosts</h4>
                    <div className="space-y-1">
                      {availableFilters.hosts.map((host: FilterItem) => (
                        <button key={host.slug} onClick={() => handleFilterToggle({ ...host, type: "hosts" })} className={cn("flex items-center w-full px-2 py-1.5 text-xs uppercase", activeFilters.includes(host.slug) ? "bg-accent" : "hover:bg-accent/5")}>
                          {host.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Takeovers Section */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Takeovers</h4>
                    <div className="space-y-1">
                      {availableFilters.takeovers.map((takeover: FilterItem) => (
                        <button key={takeover.slug} onClick={() => handleFilterToggle({ ...takeover, type: "takeovers" })} className={cn("flex items-center w-full px-2 py-1.5 text-xs uppercase", activeFilters.includes(takeover.slug) ? "bg-accent" : "hover:bg-accent/5")}>
                          {takeover.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Locations Section */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Locations</h4>
                    <div className="space-y-1">
                      {availableFilters.locations.map((location: FilterItem) => (
                        <button key={location.slug} onClick={() => handleFilterToggle({ ...location, type: "locations" })} className={cn("flex items-center w-full px-2 py-1.5 text-xs uppercase", activeFilters.includes(location.slug) ? "bg-accent" : "hover:bg-accent/5")}>
                          {location.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Section */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden pt-12">
            {/* Search Input */}
            <div className="p-4 border-b flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSkip(0);
                  setHasMore(true);
                  setResults([]);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input ref={searchInputRef} placeholder="Search all content..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Button type="submit" disabled={isLoading} className="bg-bronze-500 text-white hover:bg-bronze-600 disabled:bg-bronze-300">
                  {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </form>
            </div>

            {/* Results Section */}
            <ScrollArea
              className="flex-1"
              onScrollCapture={(e) => {
                const target = e.target as HTMLDivElement;
                const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
                if (isAtBottom && hasMore && !isLoadingMore) {
                  setIsLoadingMore(true);
                  const nextPage = Math.floor(results.length / 20) + 1;
                  searchEngine.search(buildSearchFilters(), { page: nextPage, limit: 20 }).then((response) => {
                    setResults((prev) => [...prev, ...response.items]);
                    setHasMore(response.hasMore);
                    setIsLoadingMore(false);
                  });
                }
              }}
            >
              <div className="p-4 space-y-4">
                {results.length > 0 ? (
                  <>
                    {results.map((result) => (
                      <Link key={`${result.contentType}-${result.id}-${result.slug}-${result.date}`} href={`/${result.contentType}/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                            <Image src={result.image || "/image-placeholder.svg"} alt={result.title} fill className="object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              {(() => {
                                const TypeIcon = typeLabels[result.contentType].icon;
                                return <TypeIcon className={cn("w-4 h-4", typeLabels[result.contentType].color)} />;
                              })()}
                              <span>{typeLabels[result.contentType].label}</span>
                              {result.date && (
                                <>
                                  <span>•</span>
                                  <span>{format(new Date(result.date), "MMM d, yyyy")}</span>
                                </>
                              )}
                            </div>
                            <h3 className="font-medium mb-1">{result.title}</h3>
                            {result.description && <p className="text-sm text-muted-foreground line-clamp-2">{result.description}</p>}
                            {result.genres?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {result.genres.map((genre: FilterItem) => (
                                  <Badge key={`${result.slug}-${genre.slug}`} variant="outline" className="text-xs uppercase">
                                    {genre.title}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                    <div className="h-4 flex items-center justify-center">{isLoadingMore && <Loader className="h-4 w-4 animate-spin" />}</div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    {isLoading ? (
                      <>
                        <Loader className="h-8 w-8 animate-spin mb-4" />
                        <p className="text-muted-foreground">Searching...</p>
                      </>
                    ) : searchTerm ? (
                      <>
                        <AlertCircle className="h-8 w-8 mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No results found</p>
                      </>
                    ) : (
                      <>
                        <FileQuestion className="h-8 w-8 mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Start typing to search</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
