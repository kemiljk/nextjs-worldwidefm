"use client";

import { getPosts } from "@/lib/cosmic-service";
import { PageHeader } from "@/components/shared/page-header";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PostObject } from "@/lib/cosmic-config";
import { subDays } from "date-fns";
import FeaturedContent from "../../components/editorial/featured-content";
import EditorialSection from "../../components/editorial/editorial-section";
import { FilterItem as BaseFilterItem } from "@/lib/filter-types";
import { FilterToolbar } from "./components/filter-toolbar";

type FilterItem = BaseFilterItem;

interface AvailableFilters {
  [key: string]: FilterItem[];
  article: FilterItem[];
  video: FilterItem[];
  categories: FilterItem[];
}

function EditorialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<PostObject[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: string[] }>({
    article: [],
    video: [],
    categories: [],
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({
    article: [],
    video: [],
    categories: [],
  });

  // Load URL query parameters on initial render
  useEffect(() => {
    // Get filters from URL
    const categoriesParam = searchParams.get("categories")?.split(",").filter(Boolean) || [];
    const articleParam = searchParams.get("article")?.split(",").filter(Boolean) || [];
    const videoParam = searchParams.get("video")?.split(",").filter(Boolean) || [];
    const searchParam = searchParams.get("search") || "";
    const newParam = searchParams.get("new");

    // Set active filter if any are present
    if (newParam === "true") {
      setActiveFilter("new");
    } else if (categoriesParam.length) {
      setActiveFilter("categories");
    } else if (articleParam.length) {
      setActiveFilter("article");
    } else if (videoParam.length) {
      setActiveFilter("video");
    }

    // Set filter values
    setSelectedFilters({
      article: articleParam,
      video: videoParam,
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
      if (selectedFilters.article.length) {
        params.set("article", selectedFilters.article.join(","));
      }
      if (selectedFilters.video.length) {
        params.set("video", selectedFilters.video.join(","));
      }
    }

    // Add search term to URL
    if (searchTerm) {
      params.set("search", searchTerm);
    }

    // Update URL without refreshing the page
    router.push(`?${params.toString()}`, { scroll: false });
  }, [activeFilter, selectedFilters, searchTerm, router]);

  // Update URL when filters change
  useEffect(() => {
    updateUrlParams();
  }, [activeFilter, selectedFilters, searchTerm, updateUrlParams]);

  // Fetch posts on mount
  useEffect(() => {
    const fetchPosts = async () => {
      const postsResponse = await getPosts({
        limit: 50,
        sort: "-metadata.date",
      });
      const fetchedPosts = postsResponse.objects || [];
      setPosts(fetchedPosts);

      // Extract available filters
      const allFilters: AvailableFilters = {
        article: [],
        video: [],
        categories: [],
      };

      // Create static type filters
      allFilters.article = [
        {
          id: "article",
          title: "Article",
          slug: "article",
          type: "type",
          content: "",
          status: "published",
          created_at: new Date().toISOString(),
          metadata: null,
        },
      ];

      allFilters.video = [
        {
          id: "video",
          title: "Video",
          slug: "video",
          type: "type",
          content: "",
          status: "published",
          created_at: new Date().toISOString(),
          metadata: null,
        },
      ];

      // Collect categories using Map to deduplicate
      const uniqueCategories = new Map<string, FilterItem>();
      fetchedPosts.forEach((post) => {
        if (post.metadata.categories) {
          post.metadata.categories.forEach((category) => {
            uniqueCategories.set(category.id, {
              id: category.id,
              title: category.title,
              slug: category.slug,
              type: "category",
              content: category.content || "",
              status: category.status || "published",
              created_at: category.created_at,
              metadata: category.metadata,
            });
          });
        }
      });

      // Sort categories alphabetically
      allFilters.categories = Array.from(uniqueCategories.values()).sort((a, b) => a.title.localeCompare(b.title));

      setAvailableFilters(allFilters);
    };

    fetchPosts();
  }, []);

  const handleFilterChange = (filter: string, subfilter?: string) => {
    // Clear all filters
    if (!filter) {
      setActiveFilter("");
      setSelectedFilters({
        article: [],
        video: [],
        categories: [],
      });
      return;
    }

    // Handle "new" filter (exclusive)
    if (filter === "new") {
      setActiveFilter(filter);
      setSelectedFilters({
        article: [],
        video: [],
        categories: [],
      });
      return;
    }

    // Set active filter category
    setActiveFilter(filter);

    // Handle subfilter selection (add/remove from the corresponding array)
    if (subfilter) {
      setSelectedFilters((prev) => {
        const filterKey = filter === "categories" ? "categories" : filter === "article" ? "article" : filter === "video" ? "video" : "";

        if (!filterKey) return prev;

        const currentFilters = [...prev[filterKey]];
        const index = currentFilters.indexOf(subfilter);

        // Toggle the filter
        if (index > -1) {
          currentFilters.splice(index, 1);
        } else {
          currentFilters.push(subfilter);
        }

        return {
          ...prev,
          [filterKey]: currentFilters,
        };
      });
    }
  };

  // Filter posts based on active filter
  const filteredPosts = useMemo(() => {
    if (!posts.length) return [];

    let filtered = [...posts];

    // Apply "new" filter if active
    if (activeFilter === "new") {
      const thirtyDaysAgo = subDays(new Date(), 30);
      filtered = filtered.filter((post) => {
        if (!post.metadata?.date) return false;
        const postDate = new Date(post.metadata.date);
        return !isNaN(postDate.getTime()) && postDate >= thirtyDaysAgo;
      });
    }

    // Apply article filter if there are selected article filters
    if (selectedFilters.article.length > 0) {
      filtered = filtered.filter((post) => post.metadata.type?.key === "article");
    }

    // Apply video filter if there are selected video filters
    if (selectedFilters.video.length > 0) {
      filtered = filtered.filter((post) => post.metadata.type?.key === "video");
    }

    // Apply categories filter if there are selected categories
    if (selectedFilters.categories.length > 0) {
      filtered = filtered.filter((post) => {
        if (!post.metadata.categories) return false;
        return post.metadata.categories.some((category) => selectedFilters.categories.includes(category.slug));
      });
    }

    // Apply search term if any
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((post) => post.title.toLowerCase().includes(search) || (post.metadata.excerpt && post.metadata.excerpt.toLowerCase().includes(search)));
    }

    return filtered;
  }, [posts, activeFilter, selectedFilters, searchTerm]);

  return (
    <div className="container mx-auto px-4 py-16">
      <PageHeader title="Editorial" />

      <div className="mt-8">
        <FilterToolbar availableFilters={availableFilters} activeFilter={activeFilter} selectedFilters={selectedFilters} onFilterChange={handleFilterChange} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      </div>

      {filteredPosts.length > 0 ? (
        <>
          <FeaturedContent posts={filteredPosts.slice(0, 3)} />
          <EditorialSection title="All Editorial" posts={filteredPosts} />
        </>
      ) : (
        <div className="py-16 text-center">
          <h3 className="text-xl font-medium">No posts found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your filters or search term.</p>
        </div>
      )}
    </div>
  );
}

// Main component that uses Suspense
export default function EditorialPage() {
  return (
    <div className="min-h-screen">
      <Suspense>
        <EditorialContent />
      </Suspense>
    </div>
  );
}
