"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ShowCard } from "@/components/ui/show-card";
import { getAllPosts } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { PostObject } from "@/lib/cosmic-config";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import Marquee from "@/components/ui/marquee";

interface Post extends PostObject {}

interface EditorialSectionProps {
  title: string;
  posts: Post[];
  className?: string;
  isHomepage?: boolean;
  layout?: "grid" | "list";
}

export default function EditorialSection({ title, posts, className, isHomepage = false, layout = "grid" }: EditorialSectionProps) {
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>(posts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && !isLoading && hasMore && !isHomepage) {
      loadMorePosts();
    }
  }, [inView, isLoading, hasMore, isHomepage]);

  async function loadMorePosts() {
    try {
      setIsLoading(true);
      const newPosts = await getAllPosts();

      if (newPosts.length > 0) {
        setDisplayedPosts((prev) => [...prev, ...newPosts]);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more posts:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className={cn("", className)}>
      <div className={`flex items-center justify-between mb-8 ${!isHomepage && "mt-12"}`}>
        <h2 className="text-h7 font-display uppercase font-normal text-almostblack">{title}</h2>
      </div>
      {isHomepage ? (
        <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24 h-full" speed="slow" pauseOnHover>
          <div className="grid grid-flow-col auto-cols-[440px] gap-4 h-full">
            {posts.map((post: Post) => {
              const tags = (post.metadata?.categories || [])
                .map((cat: any) => {
                  if (typeof cat === "string") return cat;
                  if (cat && typeof cat === "object" && typeof (cat as any).title === "string") return (cat as any).title;
                  return "";
                })
                .filter((tag: string) => !!tag);
              const article = {
                key: post.slug,
                name: post.title,
                url: `/editorial/${post.slug}`,
                slug: post.slug,
                pictures: {
                  large: post.metadata?.image?.imgix_url || "/image-placeholder.svg",
                },
                created_time: post.metadata?.date || "",
                tags,
                excerpt: post.metadata?.excerpt || "",
              };
              return <ShowCard key={post.id} show={article} slug={article.url} playable={false} />;
            })}
          </div>
        </Marquee>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {displayedPosts.map((post) => {
              const tags = (post.metadata?.categories || [])
                .map((cat: any) => {
                  if (typeof cat === "string") return cat;
                  if (cat && typeof cat === "object" && typeof (cat as any).title === "string") return (cat as any).title;
                  return "";
                })
                .filter((tag: string) => !!tag);
              const article = {
                key: post.slug,
                name: post.title,
                url: `/editorial/${post.slug}`,
                slug: post.slug,
                pictures: {
                  large: post.metadata?.image?.imgix_url || "/image-placeholder.svg",
                },
                created_time: post.metadata?.date || "",
                tags,
                excerpt: post.metadata?.excerpt || "",
              };
              return <ShowCard key={post.id} show={article} slug={article.url} playable={false} />;
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
      )}
    </section>
  );
}
