"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Music2, Newspaper, Calendar, Video, Loader, AlertCircle, FileQuestion, FolderSearch, MicVocal } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getMixcloudShows } from "@/lib/mixcloud-service";
import { getAllPosts, getVideos, getEvents, getTakeovers } from "@/lib/actions";
import type { ContentType } from "@/lib/search/types";
import type { MixcloudShow } from "@/lib/mixcloud-service";
import type { PostObject, VideoObject } from "@/lib/cosmic-config";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  "radio-shows": { label: "Radio Shows", icon: Music2, color: "text-foreground" },
  posts: { label: "Posts", icon: Newspaper, color: "text-foreground" },
  events: { label: "Events", icon: Calendar, color: "text-foreground" },
  videos: { label: "Videos", icon: Video, color: "text-foreground" },
  takeovers: { label: "Takeovers", icon: MicVocal, color: "text-foreground" },
};

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 20;

  // On dialog open, check which types have at least one result
  useEffect(() => {
    if (!open) return;
    async function checkTypes() {
      const types: string[] = [];
      const [mixcloud, posts, videos, events, takeovers] = await Promise.all([getMixcloudShows({ limit: 1 }), getAllPosts({ limit: 1 }), getVideos({ limit: 1 }), getEvents({ limit: 1 }), getTakeovers({ limit: 1 })]);
      if (mixcloud.shows.length > 0) types.push("radio-shows");
      if (posts.posts.length > 0) types.push("posts");
      if (events.events.length > 0) types.push("events");
      if (videos.videos.length > 0) types.push("videos");
      if (takeovers.takeovers.length > 0) types.push("takeovers");
      setAvailableTypes(types);
    }
    checkTypes();
  }, [open]);

  // Determine selected content type
  const selectedType = activeFilters.find((f) => Object.keys(typeLabels).includes(f)) || "radio-shows";
  const selectedTag = activeFilters.find((f) => !Object.keys(typeLabels).includes(f));

  // Fetch tags for the selected type
  useEffect(() => {
    if (!open) return;
    async function fetchTags() {
      let tagSet = new Set<string>();
      if (selectedType === "radio-shows") {
        const response = await getMixcloudShows({ limit: 100, offset: 0 });
        response.shows.forEach((show: MixcloudShow) => {
          show.tags?.forEach((tag) => {
            if (tag.name) tagSet.add(tag.name);
          });
        });
      } else if (selectedType === "posts") {
        const { posts } = await getAllPosts({ limit: 100, offset: 0 });
        posts.forEach((post: PostObject) => {
          post.metadata?.categories?.forEach((cat: any) => {
            if (cat.title) tagSet.add(cat.title);
          });
        });
      } else if (selectedType === "videos") {
        const { videos } = await getVideos({ limit: 100, offset: 0 });
        videos.forEach((video: VideoObject) => {
          video.metadata?.categories?.forEach((cat: any) => {
            if (cat.title) tagSet.add(cat.title);
          });
        });
      } else if (selectedType === "events") {
        const { events } = await getEvents({ limit: 100, offset: 0 });
        events.forEach((event: any) => {
          event.metadata?.categories?.forEach((cat: any) => {
            if (cat.title) tagSet.add(cat.title);
          });
        });
      } else if (selectedType === "takeovers") {
        const { takeovers } = await getTakeovers({ limit: 100, offset: 0 });
        takeovers.forEach((takeover: any) => {
          takeover.metadata?.categories?.forEach((cat: any) => {
            if (cat.title) tagSet.add(cat.title);
          });
        });
      }
      setTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
    }
    fetchTags();
  }, [open, selectedType]);

  // Fetch results for the selected type, tag, and search
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setPage(1);
    setHasNext(true);
    async function fetchResults() {
      let res: any;
      if (selectedType === "radio-shows") {
        res = await getMixcloudShows({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: 0 });
        setResults(res.shows);
        setHasNext(res.hasNext);
      } else if (selectedType === "posts") {
        res = await getAllPosts({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: 0 });
        setResults(res.posts);
        setHasNext(res.hasNext);
      } else if (selectedType === "videos") {
        res = await getVideos({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: 0 });
        setResults(res.videos);
        setHasNext(res.hasNext);
      } else if (selectedType === "events") {
        res = await getEvents({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: 0 });
        setResults(res.events);
        setHasNext(res.hasNext);
      } else if (selectedType === "takeovers") {
        res = await getTakeovers({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: 0 });
        setResults(res.takeovers);
        setHasNext(res.hasNext);
      }
      setIsLoading(false);
    }
    fetchResults();
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [open, selectedType, selectedTag, searchTerm]);

  // Infinite scroll: load more when observerTarget is in view
  useEffect(() => {
    if (!open) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingMore) {
          setIsLoadingMore(true);
          const nextOffset = page * PAGE_SIZE;
          async function fetchMore() {
            let res: any;
            if (selectedType === "radio-shows") {
              res = await getMixcloudShows({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: nextOffset });
              setResults((prev) => [...prev, ...res.shows]);
              setHasNext(res.hasNext);
            } else if (selectedType === "posts") {
              res = await getAllPosts({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: nextOffset });
              setResults((prev) => [...prev, ...res.posts]);
              setHasNext(res.hasNext);
            } else if (selectedType === "videos") {
              res = await getVideos({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: nextOffset });
              setResults((prev) => [...prev, ...res.videos]);
              setHasNext(res.hasNext);
            } else if (selectedType === "events") {
              res = await getEvents({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: nextOffset });
              setResults((prev) => [...prev, ...res.events]);
              setHasNext(res.hasNext);
            } else if (selectedType === "takeovers") {
              res = await getTakeovers({ tag: selectedTag, searchTerm, limit: PAGE_SIZE, offset: nextOffset });
              setResults((prev) => [...prev, ...res.takeovers]);
              setHasNext(res.hasNext);
            }
            setIsLoadingMore(false);
            setPage((prev) => prev + 1);
          }
          fetchMore();
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
  }, [hasNext, isLoadingMore, open, page, results.length, selectedType, selectedTag, searchTerm]);

  // Filter toggle logic (content type and tags)
  const handleFilterToggle = (filter: { type: string; slug: string }) => {
    setActiveFilters((prev) => {
      if (filter.type === "types") {
        // Only one type filter at a time
        return prev.includes(filter.slug) ? prev.filter((f) => f !== filter.slug) : [filter.slug, ...prev.filter((f) => f !== filter.slug && !tags.includes(f))];
      } else {
        // Only one tag at a time for now
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
              <div className="px-4 border-b">
                <div className="flex h-20 items-center justify-between">
                  <h3 className="font-mono uppercase text-m6">Filters</h3>
                  <div className="flex items-center gap-2">
                    {activeFilters.length > 0 && (
                      <Button variant="ghost" size="sm" className="rounded-full" onClick={clearAllFilters}>
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
                      {availableTypes.map((type) => {
                        const { label, icon: Icon, color } = typeLabels[type as ContentType];
                        return (
                          <button key={type} onClick={() => handleFilterToggle({ type: "types", slug: type })} className={cn("flex items-center w-full px-2 py-1.5 text-sm", activeFilters.includes(type) ? "bg-accent" : "hover:bg-accent/5")}>
                            <Icon className={cn("h-4 w-4 mr-2", color)} />
                            {label}
                          </button>
                        );
                      })}
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
            <div className="border-b flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setHasNext(true);
                  setResults([]);
                }}
                className="flex gap-2"
              >
                <div className="px-4 h-20 items-center flex flex-1">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input ref={searchInputRef} placeholder="Search" className="border-none pl-4 font-mono text-m6 uppercase focus-visible:ring-0" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </form>
            </div>

            {/* Results Section */}
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className="p-4 space-y-4">
                {results.length > 0 ? (
                  <>
                    {results.map((result, idx) => {
                      if (selectedType === "radio-shows") {
                        return (
                          <Link key={`${result.key}-${result.slug}-${idx}`} href={`/radio-shows/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                                <Image src={result.pictures?.large || result.pictures?.extra_large || "/image-placeholder.svg"} alt={result.name || "Radio Show Cover"} fill className="object-cover" />
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
                        );
                      } else if (selectedType === "posts") {
                        return (
                          <Link key={`${result.id}-${result.slug}-${idx}`} href={`/posts/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                                <Image src={result.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={result.title || "Post Cover"} fill className="object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Newspaper className="w-4 h-4 text-foreground" />
                                  <span>Posts</span>
                                  {result.metadata?.date && (
                                    <>
                                      <span>•</span>
                                      <span>{format(new Date(result.metadata.date), "MMM d, yyyy")}</span>
                                    </>
                                  )}
                                </div>
                                <h3 className="font-medium mb-1">{result.title}</h3>
                                {result.metadata?.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{result.metadata.excerpt}</p>}
                              </div>
                            </div>
                          </Link>
                        );
                      } else if (selectedType === "videos") {
                        return (
                          <Link key={`${result.id}-${result.slug}-${idx}`} href={`/videos/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                                <Image src={result.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={result.title || "Video Cover"} fill className="object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Video className="w-4 h-4 text-foreground" />
                                  <span>Videos</span>
                                  {result.metadata?.date && (
                                    <>
                                      <span>•</span>
                                      <span>{format(new Date(result.metadata.date), "MMM d, yyyy")}</span>
                                    </>
                                  )}
                                </div>
                                <h3 className="font-medium mb-1">{result.title}</h3>
                              </div>
                            </div>
                          </Link>
                        );
                      } else if (selectedType === "events") {
                        return (
                          <Link key={`${result.id}-${result.slug}-${idx}`} href={`/events/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                                <Image src={result.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={result.title || "Event Cover"} fill className="object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Calendar className="w-4 h-4 text-foreground" />
                                  <span>Events</span>
                                  {result.metadata?.date && (
                                    <>
                                      <span>•</span>
                                      <span>{format(new Date(result.metadata.date), "MMM d, yyyy")}</span>
                                    </>
                                  )}
                                </div>
                                <h3 className="font-medium mb-1">{result.title}</h3>
                              </div>
                            </div>
                          </Link>
                        );
                      } else if (selectedType === "takeovers") {
                        return (
                          <Link key={`${result.id}-${result.slug}-${idx}`} href={`/takeovers/${result.slug}`} onClick={() => onOpenChange(false)} className="block p-4 hover:bg-accent/5 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden ">
                                <Image src={result.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={result.title || "Takeover Cover"} fill className="object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Calendar className="w-4 h-4 text-foreground" />
                                  <span>Takeovers</span>
                                  {result.metadata?.date && (
                                    <>
                                      <span>•</span>
                                      <span>{format(new Date(result.metadata.date), "MMM d, yyyy")}</span>
                                    </>
                                  )}
                                </div>
                                <h3 className="font-medium mb-1">{result.title}</h3>
                              </div>
                            </div>
                          </Link>
                        );
                      }
                      return null;
                    })}
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
