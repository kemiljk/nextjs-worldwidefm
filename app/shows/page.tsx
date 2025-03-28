"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContentToolbar } from "@/components/shared/content-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { getAllShows } from "@/lib/actions";
import { transformShowToViewData } from "@/lib/cosmic-service";
import { useState, useMemo, useEffect } from "react";
import { format, subDays } from "date-fns";
import { RadioShowObject } from "@/lib/cosmic-config";
import { AvailableFilters, getFilterItemsFromShow, filterShowsByCategory, deduplicateFilters } from "@/lib/filter-types";

export default function ShowsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [allShows, setAllShows] = useState<RadioShowObject[]>([]);
  const [filteredShowsState, setFilteredShowsState] = useState<RadioShowObject[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [activeSubfilter, setActiveSubfilter] = useState("");
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({
    genres: [],
    locations: [],
    hosts: [],
    takeovers: [],
  });

  // Fetch shows on mount
  useEffect(() => {
    const fetchShows = async () => {
      setIsLoading(true);
      try {
        const shows = await getAllShows();
        setAllShows(shows);
        setFilteredShowsState(shows);

        // Extract available filters
        const allFilters: AvailableFilters = {
          genres: [],
          locations: [],
          hosts: [],
          takeovers: [],
        };

        shows.forEach((show: RadioShowObject) => {
          const showFilters = getFilterItemsFromShow(show);
          if (showFilters.genres) allFilters.genres.push(...showFilters.genres);
          if (showFilters.locations) allFilters.locations.push(...showFilters.locations);
          if (showFilters.hosts) allFilters.hosts.push(...showFilters.hosts);
          if (showFilters.takeovers) allFilters.takeovers.push(...showFilters.takeovers);
        });

        // Deduplicate filters
        setAvailableFilters({
          genres: deduplicateFilters(allFilters.genres),
          locations: deduplicateFilters(allFilters.locations),
          hosts: deduplicateFilters(allFilters.hosts),
          takeovers: deduplicateFilters(allFilters.takeovers),
        });
      } catch (error) {
        console.error("Error fetching shows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShows();
  }, []);

  const handleFilterChange = (filter: string, subfilter?: string) => {
    setActiveFilter(filter);
    setActiveSubfilter(subfilter || "");
  };

  // Filter shows based on active filter
  const filteredShows = useMemo(() => {
    if (!allShows.length) return [];
    if (!activeFilter) return allShows;

    switch (activeFilter) {
      case "new": {
        const thirtyDaysAgo = subDays(new Date(), 30);
        return allShows.filter((show: RadioShowObject) => {
          if (!show.metadata?.broadcast_date) return false;
          const broadcastDate = new Date(show.metadata.broadcast_date);
          return !isNaN(broadcastDate.getTime()) && broadcastDate > thirtyDaysAgo;
        });
      }
      case "genres":
      case "locations":
      case "hosts":
      case "takeovers":
        return filterShowsByCategory(allShows, activeFilter as any, activeSubfilter);
      default:
        return allShows;
    }
  }, [allShows, activeFilter, activeSubfilter]);

  // Transform filtered shows for display
  const transformedShows = useMemo(() => {
    return filteredShows.map(transformShowToViewData);
  }, [filteredShows]);

  return (
    <div className="min-h-screen bg-bronze-50/20 dark:bg-bronze-900/20 -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-24">
      <div className="mx-auto pt-24 pb-16">
        <PageHeader title="Our Shows" description="Discover all our current radio shows and programs." breadcrumbs={[{ href: "/", label: "Home" }, { label: "Shows" }]} />

        {/* Content Toolbar */}
        <ContentToolbar
          onFilterChange={(filter, subfilter) => {
            setActiveFilter(filter);
            setActiveSubfilter(subfilter || "");
          }}
          availableFilters={availableFilters}
          filterConfig={[
            { key: "genres", label: "Genres" },
            { key: "locations", label: "Locations" },
            { key: "hosts", label: "Hosts" },
            { key: "takeovers", label: "Takeovers" },
          ]}
          showNew={true}
          bgColor="bg-[#FDFBF7] dark:bg-[#000]"
        />

        {/* Shows grid */}
        {isLoading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
          </div>
        ) : transformedShows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {transformedShows.map((show, index) => (
              <Card key={show.id || index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="aspect-square relative">
                    <Image src={show.image} alt={show.title} fill className="object-cover" />
                  </div>
                  <div className="mt-4">
                    <h3 className="font-medium line-clamp-1">{show.title}</h3>
                    {show.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{show.description}</p>}
                    <div className="flex justify-between items-center mt-4">
                      <Link href={`/shows/${show.slug}`} className="text-sm text-brand-orange hover:underline">
                        View Details
                      </Link>
                      <Button size="sm" variant="ghost" className="text-brand-orange hover:bg-brand-orange/10 rounded-full p-2">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
  );
}
