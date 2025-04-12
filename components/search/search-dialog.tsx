"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Music2, Newspaper, Calendar, Video, Loader, AlertCircle, FileQuestion, FolderSearch } from "lucide-react";
import { SearchResultType, SearchResult, FilterItem } from "@/lib/search-context";
import { useSearch } from "@/lib/hooks/use-search";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchContent } from "@/lib/actions";
import { searchEngine } from "@/lib/search/engine";
import { SearchFilters, SearchOptions, SearchItem } from "@/lib/search/types";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FilterCategory = "all" | "genres" | "locations" | "hosts" | "takeovers" | "type";

const typeLabels: Record<SearchResultType, { label: string; icon: React.ElementType; color: string }> = {
  "radio-shows": { label: "Radio Shows", icon: Music2, color: "text-black dark:text-white" },
  posts: { label: "Posts", icon: Newspaper, color: "text-black dark:text-white" },
  events: { label: "Events", icon: Calendar, color: "text-black dark:text-white" },
  videos: { label: "Videos", icon: Video, color: "text-black dark:text-white" },
  takeovers: { label: "Takeovers", icon: Calendar, color: "text-black dark:text-white" },
} as const;

// Helper function to map SearchItem to SearchResult
const mapSearchItemToResult = (item: SearchItem): SearchResult => ({
  id: item.id,
  type: item.contentType as any,
  slug: item.slug,
  title: item.title,
  description: item.description,
  image: item.image,
  date: item.date,
  genres: item.genres,
  hosts: item.hosts,
  locations: item.locations,
  takeovers: item.takeovers,
});

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const context = useSearch();
  const [activeTab, setActiveTab] = useState<FilterCategory>("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Load more results when scrolling to bottom
  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextSkip = skip + 20;
      const response = await searchContent(context.searchTerm, undefined, 20);

      if (response.length > 0) {
        // Apply filters to the response
        let filteredResults = response;
        if (activeFilters.length > 0) {
          filteredResults = response.filter((item) => {
            // Check if any of the item's genres match active filters
            const matchesGenres = item.genres?.some((genre) => activeFilters.includes(genre.slug));
            // Check if any of the item's locations match active filters
            const matchesLocations = item.locations?.some((location) => activeFilters.includes(location.slug));
            // Check if any of the item's hosts match active filters
            const matchesHosts = item.hosts?.some((host) => activeFilters.includes(host.slug));
            // Check if any of the item's takeovers match active filters
            const matchesTakeovers = item.takeovers?.some((takeover) => activeFilters.includes(takeover.slug));
            // Check if the item's type matches active filters
            const matchesType = activeFilters.includes(item.type);
            // Return true if any of the filters match
            return matchesGenres || matchesLocations || matchesHosts || matchesTakeovers || matchesType;
          });
        }

        context.setResults([...context.results, ...filteredResults]);
        context.setAllContent([...context.allContent, ...filteredResults]);
        setHasMore(filteredResults.length === 20);
        setSkip(nextSkip);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more results:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  // Load initial content when dialog opens
  useEffect(() => {
    if (open) {
      // Load initial content if we don't have any
      if (!context.allContent || context.allContent.length === 0) {
        searchContent(undefined, undefined, 20)
          .then((response) => {
            context.setResults(response);
            context.setAllContent(response);
            setHasMore(response.length === 20);
            setSkip(20);
          })
          .catch((error) => {
            console.error("Error loading initial content:", error);
          });
      }
      // Focus the input when the dialog opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset pagination when search term or filters change
  useEffect(() => {
    setSkip(0);
    setHasMore(true);
  }, [context.searchTerm, activeFilters]);

  // Handle search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    try {
      // Reset pagination and results
      setSkip(0);
      setHasMore(true);

      // Perform new search with current filters
      const response = await searchContent(context.searchTerm, undefined, 20);

      // Apply filters to the response
      let filteredResults = response;

      // First, apply type filters if any exist
      const typeFilters = activeFilters.filter((f) => Object.keys(typeLabels).includes(f));
      if (typeFilters.length > 0) {
        // If we have type filters, only show items of those types
        filteredResults = response.filter((item) => typeFilters.includes(item.type));
      }

      // Then apply other filters
      const otherFilters = activeFilters.filter((f) => !Object.keys(typeLabels).includes(f));
      if (otherFilters.length > 0) {
        filteredResults = filteredResults.filter((item) => {
          // Check if any of the item's genres match active filters
          const matchesGenres = item.genres?.some((genre) => otherFilters.includes(genre.slug));
          // Check if any of the item's locations match active filters
          const matchesLocations = item.locations?.some((location) => otherFilters.includes(location.slug));
          // Check if any of the item's hosts match active filters
          const matchesHosts = item.hosts?.some((host) => otherFilters.includes(host.slug));
          // Check if any of the item's takeovers match active filters
          const matchesTakeovers = item.takeovers?.some((takeover) => otherFilters.includes(takeover.slug));
          // Return true if any of the filters match
          return matchesGenres || matchesLocations || matchesHosts || matchesTakeovers;
        });
      }

      context.setResults(filteredResults);
      context.setAllContent(filteredResults);
      setHasMore(filteredResults.length === 20);
      setSkip(20);
    } catch (error) {
      console.error("Error performing search:", error);
    }
  };

  // Function to handle filter toggle
  const handleFilterToggle = async (filter: FilterItem) => {
    // Update active filters state
    setActiveFilters((prev) => {
      let newFilters;
      if (filter.type === "types") {
        // For type filters, we want to clear any other type filters first
        const otherTypeFilters = prev.filter((f) => Object.keys(typeLabels).includes(f));
        newFilters = [...prev.filter((f) => !Object.keys(typeLabels).includes(f))];
        if (!prev.includes(filter.slug)) {
          newFilters.push(filter.slug);
        }
      } else {
        newFilters = prev.includes(filter.slug) ? prev.filter((f) => f !== filter.slug) : [...prev, filter.slug];
      }

      // Update context filters
      switch (filter.type) {
        case "genres":
          context.toggleGenreFilter(filter);
          break;
        case "locations":
          context.toggleLocationFilter(filter);
          break;
        case "hosts":
          context.toggleHostFilter(filter);
          break;
        case "takeovers":
          context.toggleTakeoverFilter(filter);
          break;
        case "types":
          // Clear other type filters first
          const otherTypeFilters = prev.filter((f) => Object.keys(typeLabels).includes(f));
          otherTypeFilters.forEach((f) => {
            context.toggleTypeFilter({ slug: f, title: typeLabels[f as SearchResultType].label, type: "types" });
          });
          if (!prev.includes(filter.slug)) {
            context.toggleTypeFilter(filter);
          }
          break;
      }

      // Perform new search with updated filters
      handleSearch();

      return newFilters;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full overflow-hidden">
          {/* Mobile Filter Button */}
          <div className="sm:hidden absolute left-2 top-2 z-50">
            <Button variant="ghost" size="icon" onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}>
              <FolderSearch className="h-5 w-5" />
            </Button>
          </div>

          {/* Filters Section */}
          <div className={cn("w-64 border-r bg-background", "fixed inset-y-0 left-0 z-50 sm:relative sm:block", "transition-transform duration-200 ease-in-out", isMobileFilterOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0")}>
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Filters</h3>
                  <div className="flex items-center gap-2">
                    {activeFilters.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6"
                        onClick={async () => {
                          // Clear all active filters
                          activeFilters.forEach((filter) => {
                            if (filter.startsWith("type-")) {
                              context.toggleTypeFilter({ slug: filter, title: "", type: "types" });
                            } else {
                              context.toggleGenreFilter({ slug: filter, title: "", type: "genres" });
                            }
                          });
                          setActiveFilters([]);

                          // Reset pagination
                          setSkip(0);
                          setHasMore(true);

                          // Load initial content
                          try {
                            const response = await searchContent(undefined, undefined, 20);
                            context.setResults(response);
                            context.setAllContent(response);
                            setHasMore(response.length === 20);
                            setSkip(20);
                          } catch (error) {
                            console.error("Error loading initial content:", error);
                          }
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setIsMobileFilterOpen(false)}>
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
                        <button key={type} onClick={() => handleFilterToggle({ slug: type, title: label, type: "types" })} className={cn("flex items-center w-full px-2 py-1.5 text-sm", activeFilters.includes(type) ? "bg-accent" : "hover:bg-accent/5")}>
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
                      {context.availableFilters.genres.map((genre: FilterItem) => (
                        <button key={genre.slug} onClick={() => handleFilterToggle({ ...genre, type: "genres" })} className={cn("flex items-center w-full px-2 py-1.5 text-sm", activeFilters.includes(genre.slug) ? "bg-accent" : "hover:bg-accent/5")}>
                          {genre.title}
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
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input ref={searchInputRef} placeholder="Search all content..." className="pl-8" value={context.searchTerm} onChange={(e) => context.setSearchTerm(e.target.value)} />
                </div>
                <Button type="submit" disabled={context.isLoading} className="bg-bronze-500 text-white hover:bg-bronze-600 disabled:bg-bronze-300">
                  {context.isLoading ? <Loader className="h-4 w-4 animate-spin" /> : "Search"}
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
                  loadMore();
                }
              }}
            >
              <div className="p-4 space-y-4">
                {context.results.length > 0 ? (
                  <>
                    {context.results.map((result: SearchResult) => (
                      <Link key={`${result.type}-${result.id}-${result.slug}-${result.date}`} href={`/${result.type}/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                            <Image src={result.image || "/image-placeholder.svg"} alt={result.title} fill className="object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              {(() => {
                                const TypeIcon = typeLabels[result.type].icon;
                                return <TypeIcon className={cn("w-4 h-4", typeLabels[result.type].color)} />;
                              })()}
                              <span>{typeLabels[result.type].label}</span>
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
                                  <Badge key={`${result.slug}-${genre.slug}`} variant="outline" className="text-xs">
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
                    {context.isLoading ? (
                      <>
                        <Loader className="h-8 w-8 animate-spin mb-4" />
                        <p className="text-muted-foreground">Searching...</p>
                      </>
                    ) : context.searchTerm ? (
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
