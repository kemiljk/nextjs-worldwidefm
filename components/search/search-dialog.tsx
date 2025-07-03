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
import { getMixcloudShows } from "@/lib/mixcloud-service";
import type { FilterItem, ContentType } from "@/lib/search/types";
import type { MixcloudShow } from "@/lib/mixcloud-service";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  "radio-shows": { label: "Radio Shows", icon: Music2, color: "text-foreground" },
  posts: { label: "Posts", icon: Newspaper, color: "text-foreground" },
  events: { label: "Events", icon: Calendar, color: "text-foreground" },
  videos: { label: "Videos", icon: Video, color: "text-foreground" },
  takeovers: { label: "Takeovers", icon: Calendar, color: "text-foreground" },
};

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<MixcloudShow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 20;

  // Fetch tags on dialog open
  useEffect(() => {
    if (!open) return;
    getMixcloudShows({ limit: 100, offset: 0 }).then((response) => {
      const tagSet = new Set<string>();
      response.shows.forEach((show) => {
        show.tags?.forEach((tag) => {
          if (tag.name) tagSet.add(tag.name);
        });
      });
      setTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
    });
  }, [open]);

  // Build params for getMixcloudShows
  const selectedTag = activeFilters.find((f) => f !== "radio-shows");
  const mixcloudParams: any = {
    tag: selectedTag,
    searchTerm,
    limit: PAGE_SIZE,
  };

  // Initial load and whenever filters/search change
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setPage(1);
    setHasNext(true);
    getMixcloudShows({ ...mixcloudParams, offset: 0 }).then((response) => {
      setResults(response.shows);
      setHasNext(response.hasNext);
      setIsLoading(false);
    });
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [open, activeFilters, searchTerm]);

  // Infinite scroll: load more when observerTarget is in view
  useEffect(() => {
    if (!open) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingMore) {
          setIsLoadingMore(true);
          const nextOffset = page * PAGE_SIZE;
          getMixcloudShows({ ...mixcloudParams, offset: nextOffset }).then((response) => {
            setResults((prev) => [...prev, ...response.shows]);
            setHasNext(response.hasNext);
            setIsLoadingMore(false);
            setPage((prev) => prev + 1);
          });
        }
      },
      {
        threshold: 0.1,
        root: scrollAreaRef.current,
      }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [hasNext, isLoadingMore, open, page, results.length]);

  // Filter toggle logic (content type and tags)
  const handleFilterToggle = (filter: { type: string; slug: string }) => {
    setActiveFilters((prev) => {
      if (filter.type === "types") {
        // Only one type filter at a time
        return prev.includes(filter.slug) ? prev.filter((f) => f !== filter.slug) : [filter.slug, ...prev.filter((f) => f !== filter.slug && !tags.includes(f))];
      } else {
        // Only one tag at a time for Mixcloud
        return prev.includes(filter.slug) ? prev.filter((f) => f !== filter.slug) : [filter.slug, ...prev.filter((f) => !tags.includes(f))];
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
                  <h3 className="font-mono uppercase text-m6">Filters</h3>
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
                  <div className="border-b border-almostblack dark:border-white py-4">
                    <div className="space-y-1">
                      {Object.entries(typeLabels).map(([type, { label, icon: Icon, color }]) => (
                        <button key={type} onClick={() => handleFilterToggle({ type: "types", slug: type })} className={cn("flex items-center w-full px-2 py-1.5 text-sm", activeFilters.includes(type) ? "bg-accent" : "hover:bg-accent/5")}>
                          <Icon className={cn("h-4 w-4 mr-2", color)} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Tags Section */}
                  <div className="border-b border-almostblack dark:border-white py-4">
                    <div className="space-y-1">
                      {tags.map((tag) => (
                        <button key={tag} onClick={() => handleFilterToggle({ type: "tags", slug: tag })} className={cn("flex items-center w-full px-2 py-1.5 text-xs uppercase", activeFilters.includes(tag) ? "bg-accent" : "hover:bg-accent/5")}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Section */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Search Input */}
            <div className="py-1 border-b flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setHasNext(true);
                  setResults([]);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input ref={searchInputRef} placeholder="Search" className="border-none pl-8 font-mono text-m6 uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </form>
            </div>

            {/* Results Section */}
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className="p-4 space-y-4">
                {results.length > 0 ? (
                  <>
                    {results.map((result, idx) => (
                      <Link key={`${result.key}-${result.slug}-${idx}`} href={`/${"radio-shows"}/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                            <Image src={result.pictures?.large || result.pictures?.extra_large || "/image-placeholder.svg"} alt={result.name} fill className="object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Music2 className="w-4 h-4 text-foreground" />
                              <span>Radio Shows</span>
                              {result.created_time && (
                                <>
                                  <span>•</span>
                                  <span>{format(new Date(result.created_time), "MMM d, yyyy")}</span>
                                </>
                              )}
                            </div>
                            <h3 className="font-medium mb-1">{result.name}</h3>
                            {result.user?.name && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                <Badge variant="outline" className="text-xs uppercase">
                                  {result.user.name}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                    {/* Sentinel for Intersection Observer infinite scroll */}
                    <div ref={observerTarget} className="h-4 col-span-full flex items-center justify-center">
                      {isLoadingMore && <Loader className="h-4 w-4 animate-spin" />}
                    </div>
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
