"use client";

import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
        <h2 className="text-xl font-medium text-foreground">{title}</h2>
      </div>
      {isHomepage ? (
        <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24" speed="slow" pauseOnHover>
          {posts.map((post) => (
            <Link key={post.id} href={`/editorial/${post.slug}`} className="flex-none w-[300px]">
              <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative aspect-square">
                    <Image src={post.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={post.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent">
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-xs text-white/60 mb-2">{post.metadata?.date ? new Date(post.metadata.date).toLocaleDateString() : ""}</p>
                        <h3 className="text-lg leading-tight text-white font-display line-clamp-2">{post.title}</h3>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </Marquee>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {displayedPosts.map((post) => (
              <Link key={post.id} href={`/editorial/${post.slug}`} className="group">
                <Card className="overflow-hidden border-foreground h-full">
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <Image src={post.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={post.title} fill className="object-cover" />
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-foreground-700 mb-2">{post.metadata?.date ? new Date(post.metadata.date).toLocaleDateString() : ""}</p>
                      <h3 className="text-sm leading-tight text-foreground font-display line-clamp-2">{post.title}</h3>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
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
