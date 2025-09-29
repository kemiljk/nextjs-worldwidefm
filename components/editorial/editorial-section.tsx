"use client";

import { Loader2, ChevronRight } from "lucide-react";
import { ArticleCard } from "@/components/ui/article-card";
import { getAllPosts } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { PostObject } from "@/lib/cosmic-config";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Marquee from "@/components/ui/marquee";

import Link from "next/link";

interface Post extends PostObject { }

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
      <div className={`flex items-center justify-between mb-4 ${!isHomepage && "mt-4"}`}>
        <h2 className="px-5 text-[40px] tracking-tight font-display uppercase font-normal text-almostblack dark:text-white">{title}</h2>
      </div>
      {isHomepage ? (
        <div className="px-5">
          <div className="flex w-full justify-between items-end mb-2">
            <h2 className="text-h8 md:text-h7 font-bold tracking-tight">
              EDITORIAL
            </h2>
            <Link
              href="/editorial"
              className="inline-flex items-center font-mono uppercase hover:underline transition-all text-sm"
            >
              See All
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {posts.slice(0, 3).map((post: Post) => {
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

              return (
                <ArticleCard
                  key={post.id}
                  title={article.name}
                  slug={article.slug}
                  image={article.pictures.large}
                  excerpt={article.excerpt}
                  date={article.created_time}
                  tags={tags}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="px-25 grid grid-cols-1 md:grid-cols-3 gap-10">
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
              return (
                <ArticleCard
                  key={post.id}
                  title={article.name}
                  slug={article.slug}
                  image={article.pictures.large}
                  date={article.created_time}
                  tags={tags}
                />
              );
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
