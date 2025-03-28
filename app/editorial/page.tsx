"use client";

import { getPosts } from "@/lib/cosmic-service";
import { ContentToolbar } from "@/components/shared/content-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { useState, useEffect, useMemo } from "react";
import { PostObject } from "@/lib/cosmic-config";
import { subDays } from "date-fns";
import FeaturedContent from "../../components/editorial/featured-content";
import EditorialSection from "../../components/editorial/editorial-section";

interface FilterItem {
  title: string;
  slug: string;
  type: string;
}

interface AvailableFilters {
  [key: string]: FilterItem[];
  types: FilterItem[];
  categories: FilterItem[];
}

interface Section {
  title: string;
  posts: PostObject[];
  layout: "grid" | "list" | "featured";
}

export default function EditorialPage() {
  const [posts, setPosts] = useState<PostObject[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [activeSubfilter, setActiveSubfilter] = useState("");
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({
    types: [],
    categories: [],
  });

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
        types: [],
        categories: [],
      };

      // Collect unique post types
      const uniqueTypes = new Map<string, FilterItem>();
      fetchedPosts.forEach((post) => {
        if (post.metadata.type) {
          uniqueTypes.set(post.metadata.type.key, {
            title: post.metadata.type.value,
            slug: post.metadata.type.key,
            type: "type",
          });
        }
      });

      // Convert types to filter items
      allFilters.types = Array.from(uniqueTypes.values());

      // Collect categories using Map to deduplicate
      const uniqueCategories = new Map<string, FilterItem>();
      fetchedPosts.forEach((post) => {
        if (post.metadata.categories) {
          post.metadata.categories.forEach((category) => {
            uniqueCategories.set(category.slug, {
              title: category.title,
              slug: category.slug,
              type: "category",
            });
          });
        }
      });

      allFilters.categories = Array.from(uniqueCategories.values());
      setAvailableFilters(allFilters);
    };

    fetchPosts();
  }, []);

  const handleFilterChange = (filter: string, subfilter?: string) => {
    // If it's a type filter (dropdown), use the filter value directly
    if (filter === "types") {
      setActiveFilter(filter);
      setActiveSubfilter(subfilter || "");
      return;
    }

    // For other filters (categories), use the filter as the subfilter
    setActiveFilter(filter);
    setActiveSubfilter(filter);
  };

  // Filter posts based on active filter
  const filteredPosts = useMemo(() => {
    if (!posts.length) return [];
    if (!activeFilter) return posts;

    switch (activeFilter) {
      case "new": {
        const thirtyDaysAgo = subDays(new Date(), 30);
        return posts.filter((post) => {
          if (!post.metadata?.date) return false;
          const postDate = new Date(post.metadata.date);
          return !isNaN(postDate.getTime()) && postDate > thirtyDaysAgo;
        });
      }
      case "types":
        return posts.filter((post) => {
          if (!activeSubfilter) return true;
          return post.metadata.type?.key === activeSubfilter;
        });
      case "categories":
        return posts.filter((post) => {
          if (!activeSubfilter) return true;
          return post.metadata.categories?.some((category) => category.slug === activeSubfilter);
        });
      default:
        return posts;
    }
  }, [posts, activeFilter, activeSubfilter]);

  // Organize posts into sections
  const sections = useMemo(() => {
    if (!posts.length) return [];

    // Get featured posts
    const featuredPosts = posts.filter((post) => post.metadata.is_featured);

    // Group remaining posts by section
    const sectionMap = new Map<string, PostObject[]>();

    posts
      .filter((post) => !post.metadata.is_featured)
      .forEach((post) => {
        const sectionName = post.metadata.section_name || "Latest";
        if (!sectionMap.has(sectionName)) {
          sectionMap.set(sectionName, []);
        }
        sectionMap.get(sectionName)?.push(post);
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
        const aPriority = posts.find((p) => p.metadata.section_name === a.title)?.metadata.section_priority || 0;
        const bPriority = posts.find((p) => p.metadata.section_name === b.title)?.metadata.section_priority || 0;
        return bPriority - aPriority;
      });

    return [{ title: "Featured", posts: featuredPosts, layout: "featured" as const }, ...sortedSections];
  }, [posts]);

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-blue-950/20 -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-24">
      <div className="mx-auto pt-24 pb-16">
        <PageHeader title="Editorial" description="Discover our latest articles, features, and stories." breadcrumbs={[{ href: "/", label: "Home" }, { label: "Editorial" }]} />

        {/* Content Toolbar */}
        <ContentToolbar
          onFilterChange={handleFilterChange}
          availableFilters={availableFilters}
          filterConfig={[
            { key: "types", label: "Types" },
            { key: "categories", label: "Categories" },
          ]}
          bgColor="bg-blue-50 dark:bg-blue-950/20"
        />

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
