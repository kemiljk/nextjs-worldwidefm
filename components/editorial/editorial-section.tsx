"use client";

import { Loader2 } from "lucide-react";
import { ShowCard } from "@/components/ui/show-card";
import { getAllPosts } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { PostObject } from "@/lib/cosmic-config";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Marquee from "@/components/ui/marquee";

interface Post extends PostObject {}

interface EditorialSectionProps {
  title: string;
  posts: Post[];
  className?: string;
  isHomepage?: boolean;
  layout?: "grid" | "list";
}

export default function EditorialSection({ title, posts, className, isHomepage = false }: EditorialSectionProps) {
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>(posts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function loadMorePosts() {
    try {
      setIsLoading(true);
      const newPosts = await getAllPosts({ limit: 20, offset: displayedPosts.length });

      if (newPosts.posts.length > 0) {
        setDisplayedPosts((prev) => [...prev, ...newPosts.posts]);
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
        <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">{title}</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          {/* Load More Button */}
          {hasMore && (
            <div className="w-full flex items-center justify-center mt-8">
              <Button onClick={loadMorePosts} disabled={isLoading} variant="outline" className="border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
