"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { PostObject } from "@/lib/cosmic-config";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { getAllPosts } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { subDays } from "date-fns";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface PostsGridProps {
  initialPosts: PostObject[];
  activeFilter?: string;
  activeSubfilter?: string;
}

export default function PostsGrid({ initialPosts, activeFilter = "", activeSubfilter = "" }: PostsGridProps) {
  const [posts, setPosts] = useState<PostObject[]>(initialPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { ref, inView } = useInView();

  // Reset posts when filters change
  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(true);
  }, [initialPosts, activeFilter, activeSubfilter]);

  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      loadMorePosts();
    }
  }, [inView, activeFilter, activeSubfilter]);

  async function loadMorePosts() {
    try {
      setIsLoading(true);
      const newPosts = await getAllPosts();

      // Apply filters to new posts
      const filteredNewPosts = filterPosts(newPosts);

      if (filteredNewPosts.length > 0) {
        setPosts((prev) => [...prev, ...filteredNewPosts]);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more posts:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter posts based on active filters
  const filterPosts = (postsToFilter: PostObject[]): PostObject[] => {
    if (!activeFilter) return postsToFilter;

    switch (activeFilter) {
      case "new": {
        const thirtyDaysAgo = subDays(new Date(), 30);
        return postsToFilter.filter((post) => {
          if (!post.metadata?.date) return false;
          const postDate = new Date(post.metadata.date);
          return !isNaN(postDate.getTime()) && postDate > thirtyDaysAgo;
        });
      }
      case "types":
        return postsToFilter.filter((post) => {
          if (!activeSubfilter) return true;
          return post.metadata.type?.key === activeSubfilter;
        });
      case "categories":
        return postsToFilter.filter((post) => {
          if (!activeSubfilter) return true;
          return post.metadata.categories?.some((category) => category.slug === activeSubfilter);
        });
      default:
        return postsToFilter;
    }
  };

  // Get filtered posts
  const filteredPosts = filterPosts(posts);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredPosts.map((post) => {
          const postDate = post.metadata?.date ? new Date(post.metadata.date) : null;
          const formattedDate = postDate ? format(postDate, "dd-MM-yyyy") : "";

          return (
            <Link href={`/editorial/${post.slug}`} key={post.slug} className="group border border-sky-900 dark:border-sky-50 p-4">
              <div className="relative">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image src={post.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={post.title} fill className="object-cover" />
                </div>
                <div className="mt-2">
                  <div className="text-xs leading-none uppercase text-muted-foreground mb-1">{formattedDate}</div>
                  <h3 className=" text-base group-hover:text-sky-50 transition-colors line-clamp-2">{post.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {post.metadata.categories?.map((category) => (
                      <span key={category.slug} className="text-[9.5px] leading-none uppercase px-2 py-1 rounded-full border border-black dark:border-white">
                        {category.title}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs leading-none uppercase text-muted-foreground mt-2">By {typeof post.metadata.author === "string" ? post.metadata.author : post.metadata.author?.title || "WWFM"}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Loading indicator */}
      <div ref={ref} className="mt-8 flex justify-center">
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading more posts...</span>
          </div>
        )}
      </div>
    </>
  );
}
