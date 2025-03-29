"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Music2, Newspaper, Calendar, Video, AlertTriangle, Loader, AlertCircle, FileQuestion, FolderSearch } from "lucide-react";
import { useSearch, SearchResultType, SearchResult, FilterItem } from "@/lib/search-context";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define a FilterCategory type for the active tab
type FilterCategory = "all" | "type" | "genres" | "locations" | "hosts" | "takeovers" | SearchResultType;

const typeLabels: Record<SearchResultType, { label: string; icon: React.ElementType; color: string }> = {
  "radio-shows": { label: "Radio Shows", icon: Music2, color: "text-orange-500" },
  posts: { label: "Posts", icon: Newspaper, color: "text-blue-500" },
  events: { label: "Events", icon: Calendar, color: "text-green-500" },
  videos: { label: "Videos", icon: Video, color: "text-red-500" },
  takeovers: { label: "Takeovers", icon: Calendar, color: "text-bronze-500" },
} as const;

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const context = useSearch();
  const [activeTab, setActiveTab] = useState<FilterCategory>("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // When dialog opens, focus the search input
  useEffect(() => {
    if (open && searchInputRef.current) {
      // Small delay to ensure the dialog is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // When dialog is opened, trigger a search if needed
  useEffect(() => {
    if (!open) return;

    console.log(`Search dialog opened, content status:`, {
      hasResults: context.results.length > 0,
      hasAllContent: context.allContent.length > 0,
      isLoading: context.isLoading,
      searchTerm: context.searchTerm,
    });

    // If we already have results and there's a search term, don't perform a new search
    if (context.results.length > 0 && context.searchTerm) {
      console.log("Already have results for current search term, not reloading");
      return;
    }

    // If we have no search term and no content/results, load all content
    if (context.allContent.length === 0 && !context.isLoading) {
      console.log("Performing initial search to load all content");

      // Reset filters when opening with fresh search
      if (Object.keys(context.filters).length > 0) {
        context.setFilters({});
      }

      context.performSearch("");
    }
  }, [open, context]);

  // Calculate which content to display
  const sourceContent = useMemo(() => {
    // If we have search results, use them
    if (context.results.length > 0) {
      return context.results;
    }
    // Otherwise use all content if available
    else if (context.allContent.length > 0) {
      return context.allContent;
    }
    // Empty array if nothing available
    return [];
  }, [context.results, context.allContent]);

  // Filter content based on active tab
  const filteredContent = useMemo(() => {
    if (activeTab === "all") {
      return sourceContent;
    } else {
      return sourceContent.filter((item) => {
        // For specific filter categories
        switch (activeTab) {
          case "genres":
            return item.genres && item.genres.some((genre) => activeFilters.includes(genre.slug));
          case "locations":
            return item.locations && item.locations.some((location) => activeFilters.includes(location.slug));
          case "hosts":
            return item.hosts && item.hosts.some((host) => activeFilters.includes(host.slug));
          case "takeovers":
            return item.takeovers && item.takeovers.some((takeover) => activeFilters.includes(takeover.slug));
          case "type":
            return activeFilters.includes(item.type);
          default:
            return true;
        }
      });
    }
  }, [sourceContent, activeTab, activeFilters]);

  // Function to handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (context.searchTerm.trim()) {
      context.performSearch(context.searchTerm);
    }
  };

  // Function to handle opening/closing the dialog
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset filters and search term on close
      context.setFilters({});
      context.setSearchTerm("");
      setActiveTab("all");
      setActiveFilters([]);
    }
    onOpenChange(open);
  };

  // Function to toggle filter tab
  const handleTabChange = (tab: FilterCategory) => {
    if (activeTab === tab) {
      setActiveTab("all");
      setActiveFilters([]);
    } else {
      setActiveTab(tab);
      setActiveFilters([]);
    }
  };

  // Function to toggle filter
  const handleFilterToggle = (filter: FilterItem) => {
    // Toggle active filters
    setActiveFilters((prev) => {
      if (prev.includes(filter.slug)) {
        return prev.filter((f) => f !== filter.slug);
      } else {
        return [...prev, filter.slug];
      }
    });

    // Also use the context filter toggles for better search experience
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
        context.toggleTypeFilter(filter);
        break;
    }
  };

  // Helper function to debug host search
  const debugHostSearch = (name: string) => {
    if (process.env.NODE_ENV !== "development") return;

    console.log(`Debugging search for host: "${name}"`);
    let matchCount = 0;
    const lowerName = name.toLowerCase();

    // Check all content for this host name
    context.allContent.forEach((item) => {
      let found = false;
      const matches: string[] = [];

      // Check hosts
      const hostsMatch = item.hosts?.some((host) => {
        const match = host.title.toLowerCase().includes(lowerName);
        if (match) {
          matches.push(`host: ${host.title}`);
          return true;
        }
        return false;
      });

      // Check takeovers
      const takeoversMatch = item.takeovers?.some((takeover) => {
        const match = takeover.title.toLowerCase().includes(lowerName);
        if (match) {
          matches.push(`takeover: ${takeover.title}`);
          return true;
        }
        return false;
      });

      // Check genres
      const genresMatch = item.genres?.some((genre) => {
        const match = genre.title.toLowerCase().includes(lowerName);
        if (match) {
          matches.push(`genre: ${genre.title}`);
          return true;
        }
        return false;
      });

      // Check title
      if (item.title.toLowerCase().includes(lowerName)) {
        matches.push(`title: ${item.title}`);
        found = true;
      }

      // Check description/excerpt
      if (item.description && item.description.toLowerCase().includes(lowerName)) {
        matches.push(`description: ${item.description.substring(0, 50)}...`);
        found = true;
      }

      if (item.excerpt && item.excerpt.toLowerCase().includes(lowerName)) {
        matches.push(`excerpt: ${item.excerpt.substring(0, 50)}...`);
        found = true;
      }

      // Check metadata if available
      if (item.metadata) {
        for (const [key, value] of Object.entries(item.metadata)) {
          if (typeof value === "string" && value.toLowerCase().includes(lowerName)) {
            matches.push(`metadata.${key}: ${value.substring(0, 50)}...`);
            found = true;
          } else if (Array.isArray(value)) {
            // Handle arrays of strings or objects
            value.forEach((item: any, index: number) => {
              if (typeof item === "string" && item.toLowerCase().includes(lowerName)) {
                matches.push(`metadata.${key}[${index}]: ${item}`);
                found = true;
              } else if (item && typeof item === "object") {
                // Check each property
                for (const [propKey, propVal] of Object.entries(item)) {
                  if (typeof propVal === "string" && propVal.toLowerCase().includes(lowerName)) {
                    matches.push(`metadata.${key}[${index}].${propKey}: ${propVal}`);
                    found = true;
                  }
                }
              }
            });
          }
        }
      }

      if (hostsMatch || takeoversMatch || genresMatch || found) {
        matchCount++;
        console.log(`Found "${name}" in item: ${item.title} (${item.type})`);
        console.log(`  Matches: ${matches.join(", ")}`);
      }
    });

    console.log(`Total matches for "${name}": ${matchCount} out of ${context.allContent.length} items`);

    if (matchCount === 0 && lowerName === "gilles") {
      console.log("NO MATCHES FOUND FOR GILLES - Checking raw data structure of a few items:");
      context.allContent.slice(0, 3).forEach((item, i) => {
        console.log(`Example Item ${i + 1}: ${item.title}`);
        console.log(`- Type: ${item.type}`);
        console.log(`- Hosts:`, item.hosts);
        console.log(`- Takeovers:`, item.takeovers);
        if (item.metadata) {
          console.log(`- Metadata keys:`, Object.keys(item.metadata));
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
        <div className="flex h-full overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r shrink-0 h-full overflow-y-auto">
            <div className="p-4 space-y-6">
              <div>
                <h3 className="font-medium mb-2">Content Type</h3>
                <div className="space-y-2">
                  <Button key="type-all" variant="ghost" className={cn("flex items-center gap-2 px-3 py-1 text-sm font-medium", activeTab === "all" && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleTabChange("all")}>
                    All Content
                  </Button>
                  {Object.entries(typeLabels).map(([type, { label, icon: Icon, color }]) => (
                    <Button key={type} variant="ghost" className={cn("flex items-center gap-2 px-3 py-1 text-sm", activeTab === type && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleTabChange(type as SearchResultType)}>
                      <Icon className="h-4 w-4" style={{ color }} />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {context.availableFilters.genres.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Genres</h3>
                  <ScrollArea className="h-52">
                    <div className="space-y-1 pr-4">
                      <Button key="filter-genre-all" variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start font-medium", (!context.filters.genres || context.filters.genres.length === 0) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(context.availableFilters.genres[0])}>
                        All Genres
                      </Button>
                      {context.availableFilters.genres
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((genre) => (
                          <Button key={`filter-genre-${genre.slug}`} variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start", activeFilters.includes(genre.slug) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(genre)}>
                            {genre.title}
                          </Button>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {context.availableFilters.locations.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Locations</h3>
                  <ScrollArea className="h-40">
                    <div className="space-y-1 pr-4">
                      <Button key="filter-location-all" variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start font-medium", (!context.filters.locations || context.filters.locations.length === 0) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(context.availableFilters.locations[0])}>
                        All Locations
                      </Button>
                      {context.availableFilters.locations
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((location) => (
                          <Button key={`filter-location-${location.slug}`} variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start", activeFilters.includes(location.slug) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(location)}>
                            {location.title}
                          </Button>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {context.availableFilters.hosts.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Hosts</h3>
                  <ScrollArea className="h-40">
                    <div className="space-y-1 pr-4">
                      <Button key="filter-host-all" variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start font-medium", (!context.filters.hosts || context.filters.hosts.length === 0) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(context.availableFilters.hosts[0])}>
                        All Hosts
                      </Button>
                      {context.availableFilters.hosts
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((host) => (
                          <Button key={`filter-host-${host.slug}`} variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start", activeFilters.includes(host.slug) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(host)}>
                            {host.title}
                          </Button>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {context.availableFilters.takeovers.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Takeovers</h3>
                  <ScrollArea className="h-40">
                    <div className="space-y-1 pr-4">
                      <Button key="filter-takeover-all" variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start font-medium", (!context.filters.takeovers || context.filters.takeovers.length === 0) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(context.availableFilters.takeovers[0])}>
                        All Takeovers
                      </Button>
                      {context.availableFilters.takeovers
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((takeover) => (
                          <Button key={`filter-takeover-${takeover.slug}`} variant="ghost" className={cn("px-3 py-1 text-sm w-full justify-start", activeFilters.includes(takeover.slug) && "bg-bronze-500 text-white hover:bg-bronze-500 hover:text-white")} onClick={() => handleFilterToggle(takeover)}>
                            {takeover.title}
                          </Button>
                        ))}
                    </div>
                  </ScrollArea>
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
                <Input
                  placeholder="Search shows, articles, events..."
                  value={context.searchTerm}
                  onChange={(e) => context.setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      context.performSearch(context.searchTerm);
                    }
                  }}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-lg"
                  ref={searchInputRef}
                />
                <Button variant="secondary" className="mr-8" size="sm" onClick={() => context.performSearch(context.searchTerm)}>
                  <Search className="h-4 w-4" />
                </Button>
                {process.env.NODE_ENV === "development" && (
                  <Button variant="outline" size="sm" className="text-xs bg-amber-50 border-amber-200 hover:bg-amber-100" onClick={() => debugHostSearch(context.searchTerm)}>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Debug Search
                  </Button>
                )}
              </div>
            </div>

            {/* Results grid - scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {context.isLoading ? (
                  <div className="h-full flex-1 flex items-center justify-center flex-col space-y-4 p-8">
                    <Loader className="h-8 w-8 animate-spin text-bronze-500" />
                    <p className="text-muted-foreground">Loading content...</p>
                  </div>
                ) : context.error ? (
                  <div className="h-full flex-1 flex items-center justify-center flex-col space-y-4 p-8 max-w-2xl text-center">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                    <p className="text-muted-foreground">{context.error}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        context.performSearch("");
                      }}
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : filteredContent.length === 0 ? (
                  <div className="h-full flex-1 flex items-center justify-center flex-col space-y-4 p-8">
                    <FolderSearch className="h-8 w-8 text-bronze-500" />
                    <p className="text-muted-foreground">No results found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredContent.map((item) => (
                      <Link key={`${item.type}-${item.slug}`} href={`/${item.type}/${item.slug}`} onClick={() => handleOpenChange(false)} className="group">
                        <div className="flex flex-col h-full">
                          <div className="relative aspect-square">
                            <Image src={item.image || "/image-placeholder.svg"} alt={item.title} fill className="object-cover rounded" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
