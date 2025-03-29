"use client";

import { getPosts } from "@/lib/cosmic-service";
import { PageHeader } from "@/components/shared/page-header";
import { useState, useEffect, useMemo, useCallback } from "react";
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

export default function EditorialPage() {
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
        if (!post.metadata.categories?.length) return false;

        // Check if post has ANY of the selected categories
        return post.metadata.categories.some((category) => selectedFilters.categories.includes(category.id));
      });
    }

    // Apply search term filter if search term exists
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((post) => post.title.toLowerCase().includes(term) || (post.metadata.description ? post.metadata.description.toLowerCase().includes(term) : false) || (post.metadata.excerpt ? post.metadata.excerpt.toLowerCase().includes(term) : false));
    }

    return filtered;
  }, [posts, activeFilter, selectedFilters, searchTerm]);

  // Organize posts into sections
  const sections = useMemo(() => {
    if (!filteredPosts.length) return [];

    // Get featured posts
    const featuredPosts = filteredPosts.filter((post) => post.metadata.is_featured);

    // Group remaining posts by section
    const sectionMap = new Map<string, PostObject[]>();

    filteredPosts
      .filter((post) => !post.metadata.is_featured)
      .forEach((post) => {
        // Get section title from connected section object or fallback to "Latest"
        const sectionTitle = post.metadata.section?.title || "Latest";
        if (!sectionMap.has(sectionTitle)) {
          sectionMap.set(sectionTitle, []);
        }
        sectionMap.get(sectionTitle)?.push(post);
      });

    // Convert to array and sort by priority
    const sortedSections = Array.from(sectionMap.entries())
      .map(([title, posts]) => ({
        title,
        posts: posts.sort((a, b) => {
          const dateA = a.metadata.date ? new Date(a.metadata.date).getTime() : 0;
          const dateB = b.metadata.date ? new Date(b.metadata.date).getTime() : 0;
          return dateB - dateA;
        }),
        layout: title === "Latest" ? ("grid" as const) : ("list" as const),
      }))
      .sort((a, b) => {
        // Get priority from section object if available
        const aPriority = posts.find((p) => p.metadata.section?.title === a.title)?.metadata.section?.metadata?.priority || 0;
        const bPriority = posts.find((p) => p.metadata.section?.title === b.title)?.metadata.section?.metadata?.priority || 0;
        return bPriority - aPriority;
      });

    return [{ title: "Featured", posts: featuredPosts, layout: "featured" as const }, ...sortedSections];
  }, [filteredPosts, posts]);

  // Handle search changes
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-blue-950/20 -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-24">
      <div className="mx-auto pt-24 pb-16">
        <PageHeader title="Editorial" description="Discover our latest articles, features, and stories." breadcrumbs={[{ href: "/", label: "Home" }, { label: "Editorial" }]} />

        {/* FilterToolbar */}
        <FilterToolbar onFilterChange={handleFilterChange} onSearchChange={handleSearchChange} searchTerm={searchTerm} activeFilter={activeFilter} selectedFilters={selectedFilters} availableFilters={availableFilters} />

        {/* Sections */}
        {sections.map((section, index) => (
          <div key={section.title} className={index === 0 ? "" : "mt-16"}>
            {section.layout === "featured" ? <FeaturedContent posts={section.posts} /> : <EditorialSection title={section.title} posts={section.posts} layout={section.layout} />}
          </div>
        ))}

        {/* No Content State */}
        {!sections.length && (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600 dark:text-gray-400">No posts found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
