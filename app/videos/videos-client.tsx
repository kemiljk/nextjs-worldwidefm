"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VideoGrid from "@/components/video/video-grid";
import { VideoObject } from "@/lib/cosmic-config";
import { subDays } from "date-fns";
import { VideoFilterToolbar } from "./components/video-filter-toolbar";

interface VideoCategory {
  id: string;
  title: string;
  slug: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  metadata: null;
}

interface VideosClientProps {
  initialVideos: VideoObject[];
  availableCategories: VideoCategory[];
}

export default function VideosClient({ initialVideos, availableCategories }: VideosClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log("DEBUG Videos: Available categories:", availableCategories);
  console.log(
    "DEBUG Videos: All videos structure:",
    initialVideos.map((v) => ({
      title: v.title,
      metadata: v.metadata,
      hasCategories: !!v.metadata?.categories,
      categoriesLength: v.metadata?.categories?.length || 0,
    }))
  );
  console.log("DEBUG Videos: Raw first video:", initialVideos[0]);

  const [videos, setVideos] = useState<VideoObject[]>(initialVideos);

  const [activeFilter, setActiveFilter] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: string[] }>({
    categories: [],
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Load URL query parameters on initial render
  useEffect(() => {
    const categoriesParam = searchParams.get("categories")?.split(",").filter(Boolean) || [];
    const searchParam = searchParams.get("search") || "";
    const newParam = searchParams.get("new");

    // Set active filter if any are present
    if (newParam === "true") {
      setActiveFilter("new");
    } else if (categoriesParam.length) {
      setActiveFilter("categories");
    }

    // Set filter values
    setSelectedFilters({
      categories: categoriesParam,
    });

    // Set search term
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  // Update URL when filters change
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();

    // Add active filters to URL
    if (activeFilter === "new") {
      params.set("new", "true");
    } else {
      if (selectedFilters.categories.length) {
        params.set("categories", selectedFilters.categories.join(","));
      }
    }

    // Add search term to URL
    if (searchTerm) {
      params.set("search", searchTerm);
    }

    // Update URL without refreshing the page
    router.push(`/videos${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [activeFilter, selectedFilters, searchTerm, router]);

  // Update URL when filters change
  useEffect(() => {
    updateUrlParams();
  }, [activeFilter, selectedFilters, searchTerm, updateUrlParams]);

  const handleFilterChange = (filter: string, subfilter?: string) => {
    console.log("DEBUG Videos: handleFilterChange called with:", { filter, subfilter });

    // Clear all filters
    if (!filter) {
      console.log("DEBUG Videos: Clearing all filters");
      setActiveFilter("");
      setSelectedFilters({
        categories: [],
      });
      return;
    }

    // Handle "new" filter (exclusive)
    if (filter === "new") {
      console.log("DEBUG Videos: Setting new filter");
      setActiveFilter(filter);
      setSelectedFilters({
        categories: [],
      });
      return;
    }

    // Set active filter category
    console.log("DEBUG Videos: Setting active filter to:", filter);
    setActiveFilter(filter);

    // Handle subfilter selection (add/remove from the corresponding array)
    if (subfilter) {
      console.log("DEBUG Videos: Handling subfilter:", subfilter);
      setSelectedFilters((prev) => {
        const filterKey = filter === "categories" ? "categories" : "";

        if (!filterKey) {
          console.log("DEBUG Videos: No valid filter key for:", filter);
          return prev;
        }

        const currentFilters = [...prev[filterKey]];
        const index = currentFilters.indexOf(subfilter);

        // Toggle the filter
        if (index > -1) {
          console.log("DEBUG Videos: Removing filter:", subfilter);
          currentFilters.splice(index, 1);
        } else {
          console.log("DEBUG Videos: Adding filter:", subfilter);
          currentFilters.push(subfilter);
        }

        const newFilters = {
          ...prev,
          [filterKey]: currentFilters,
        };

        console.log("DEBUG Videos: New selected filters:", newFilters);
        return newFilters;
      });
    }
  };

  // Filter videos based on active filter
  const filteredVideos = useMemo(() => {
    if (!videos.length) return [];

    let filtered = [...videos];

    // Apply "new" filter if active
    if (activeFilter === "new") {
      const thirtyDaysAgo = subDays(new Date(), 30);
      filtered = filtered.filter((video) => {
        if (!video.metadata?.date) return false;
        const videoDate = new Date(video.metadata.date);
        return !isNaN(videoDate.getTime()) && videoDate >= thirtyDaysAgo;
      });
    }

    // Apply categories filter if there are selected categories
    if (selectedFilters.categories.length > 0) {
      console.log("DEBUG Videos: Selected category filters:", selectedFilters.categories);
      console.log("DEBUG Videos: Before filtering:", filtered.length, "videos");

      filtered = filtered.filter((video) => {
        if (!video.metadata?.categories) {
          console.log("DEBUG Videos: Video has no categories:", video.title);
          return false;
        }

        const videoCategorySlugs = video.metadata.categories.map((c) => c.slug);
        const hasMatch = video.metadata.categories.some((category) => selectedFilters.categories.includes(category.slug));

        console.log("DEBUG Videos: Video:", video.title);
        console.log("  - Video categories:", videoCategorySlugs);
        console.log("  - Selected filters:", selectedFilters.categories);
        console.log("  - Has match:", hasMatch);

        return hasMatch;
      });

      console.log("DEBUG Videos: After filtering:", filtered.length, "videos");
    }

    // Apply search term if any
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((video) => video.title.toLowerCase().includes(search) || (video.metadata.description && video.metadata.description.toLowerCase().includes(search)));
    }

    return filtered;
  }, [videos, activeFilter, selectedFilters, searchTerm]);

  return (
    <>
      <div className="mt-8">
        <VideoFilterToolbar availableCategories={availableCategories} activeFilter={activeFilter} selectedFilters={selectedFilters} onFilterChange={handleFilterChange} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      </div>

      {filteredVideos.length > 0 ? (
        <VideoGrid videos={filteredVideos} />
      ) : (
        <div className="py-16 text-center">
          <h3 className="text-xl font-medium">No videos found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your filters or search term.</p>
        </div>
      )}
    </>
  );
}
