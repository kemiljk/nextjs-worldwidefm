"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useMemo } from "react";
import { SearchResult, FilterItem } from "@/lib/search-context";
import { getAllSearchableContent } from "@/lib/actions";
import { ContentToolbar } from "@/components/shared/content-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { AvailableFilters } from "@/lib/filter-types";
import { format } from "date-fns";

export default function ArchivePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [allContent, setAllContent] = useState<SearchResult[]>([]);
  const [filteredContent, setFilteredContent] = useState<SearchResult[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({
    genres: [],
    locations: [],
    hosts: [],
    takeovers: [],
  });

  // Fetch all searchable content on mount
  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      try {
        const content = await getAllSearchableContent();
        const radioShows = content.filter((item: SearchResult) => item.type === "radio-shows");
        setAllContent(radioShows);
        setFilteredContent(radioShows);

        // Extract available filters from radio shows using Maps for deduplication
        const genresMap = new Map<string, FilterItem>();
        const locationsMap = new Map<string, FilterItem>();
        const hostsMap = new Map<string, FilterItem>();
        const takeoversMap = new Map<string, FilterItem>();

        radioShows.forEach((show: SearchResult) => {
          show.genres.forEach((genre) => genresMap.set(genre.slug, genre));
          show.locations.forEach((location) => locationsMap.set(location.slug, location));
          show.hosts.forEach((host) => hostsMap.set(host.slug, host));
          show.takovers.forEach((takeover) => takeoversMap.set(takeover.slug, takeover));
        });

        setAvailableFilters({
          genres: Array.from(genresMap.values()),
          locations: Array.from(locationsMap.values()),
          hosts: Array.from(hostsMap.values()),
          takeovers: Array.from(takeoversMap.values()),
        });
      } catch (error) {
        console.error("Error fetching content:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
  };

  // Filter content based on search term and active filter
  useEffect(() => {
    let filtered = allContent;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => item.title.toLowerCase().includes(term) || (item.description || "").toLowerCase().includes(term) || (item.genres || []).some((genre) => genre.title.toLowerCase().includes(term)));
    }

    // Filter by active filter
    if (activeFilter) {
      filtered = filtered.filter((item) => {
        // Check all possible filter types
        return item.genres?.some((genre) => genre.slug === activeFilter) || item.locations?.some((location) => location.slug === activeFilter) || item.hosts?.some((host) => host.slug === activeFilter) || item.takovers?.some((takeover) => takeover.slug === activeFilter);
      });
    }

    setFilteredContent(filtered);
  }, [searchTerm, activeFilter, allContent]);

  return (
    <div className="min-h-screen bg-bronze-50/20 dark:bg-bronze-900/20 -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-24">
      <div className="mx-auto pt-24 pb-16">
        <PageHeader title="Show Archive" description="Explore our collection of past broadcasts and shows." breadcrumbs={[{ href: "/", label: "Home" }, { label: "Archive" }]} />

        {/* Search and filter bar */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow border border-bronze-900 dark:border-bronze-50">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Search shows..." className="pl-10 bg-background border-none focus-visible:ring-brand-orange" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Content Toolbar */}
        <ContentToolbar
          onFilterChange={handleFilterChange}
          availableFilters={availableFilters}
          filterConfig={[
            { key: "genres", label: "Genres" },
            { key: "locations", label: "Locations" },
            { key: "hosts", label: "Hosts" },
            { key: "takovers", label: "Takeovers" },
          ]}
          showNew={false}
          bgColor="bg-[#FDFBF7] dark:bg-[#000]"
        />

        {/* Archive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {isLoading ? (
            <div className="col-span-full flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
            </div>
          ) : filteredContent.length > 0 ? (
            filteredContent.map((item) => (
              <Card key={`${item.slug}-${item.id}`} className="overflow-hidden border border-bronze-900 dark:border-bronze-50 shadow-none">
                <CardContent className="p-0 relative">
                  <div className="aspect-square relative">
                    <Image src={item.image || "/image-placeholder.svg"} alt={item.title} fill className="object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {item.genres &&
                        item.genres.length > 0 &&
                        item.genres.map((genre, index) => (
                          <span key={`${item.slug}-${genre.slug}-${index}`} className="text-xs px-2 py-1 rounded-full border border-bronze-900 dark:border-bronze-50">
                            {genre.title}
                          </span>
                        ))}
                    </div>
                    <h3 className="font-medium line-clamp-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description || ""}</p>
                    <p className="text-xs text-muted-foreground mt-3 mb-3">
                      {item.date
                        ? new Date(item.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "No date available"}
                    </p>
                    <div className="flex justify-between items-center">
                      <Link href={`/shows/${item.slug}`} className="text-sm text-brand-orange hover:underline">
                        View Details
                      </Link>
                      <Button size="sm" variant="ghost" className="text-brand-orange hover:bg-brand-orange/10 rounded-full p-2">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">{searchTerm ? "No results found for your search." : "No shows available at the moment."}</p>
              {searchTerm && (
                <Button variant="outline" className="text-brand-orange border-brand-orange hover:bg-brand-orange/10" onClick={() => setSearchTerm("")}>
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
