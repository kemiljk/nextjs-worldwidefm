"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { PostObject } from "@/lib/cosmic-config";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { getAllPosts } from "@/lib/actions";

interface PostsGridProps {
  initialPosts: PostObject[];
}

export default function PostsGrid({ initialPosts }: PostsGridProps) {
  const [posts, setPosts] = useState<PostObject[]>(initialPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      loadMorePosts();
    }
  }, [inView]);

  async function loadMorePosts() {
    try {
      setIsLoading(true);
      const newPosts = await getAllPosts();
      if (newPosts.length > 0) {
        setPosts((prev) => [...prev, ...newPosts]);
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
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post, index) => {
          const key = `${post.id}-${index}`;
          const postType = "article"; // Default to article type since we don't have post_type in metadata
          const isHeroArticle = index === 0 || index === 1;

          if (isHeroArticle) {
            return (
              <Link key={key} href={`/${postType}s/${post.slug}`}>
                <div className="group">
                  <div className="relative aspect-[3/2] w-full overflow-hidden rounded-none">
                    <Image src={post.metadata?.image?.imgix_url || "/placeholder.svg"} alt={post.title} fill className="object-cover" />
                    <div className="absolute top-6 left-6 bg-black text-white text-xs px-3 py-1 uppercase tracking-wider">{postType}</div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">WWFM</div>
                    <h3 className="text-xl mt-2 font-medium">{post.title}</h3>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{post.metadata?.date ? formatDate(post.metadata.date) : ""}</div>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform text-gray-600 dark:text-gray-400 group-hover:text-brand-blue-dark dark:group-hover:text-brand-blue-light" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          }

          return (
            <Link key={key} href={`/${postType}s/${post.slug}`}>
              <div className="group flex gap-4">
                <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden rounded-none">
                  <Image src={post.metadata?.image?.imgix_url || "/placeholder.svg"} alt={post.title} fill className="object-cover" />
                  <div className="absolute top-2 left-2 bg-black text-white text-[10px] px-2 py-0.5 uppercase tracking-wider">{postType}</div>
                </div>
                <div className="flex-grow">
                  <div className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">WWFM</div>
                  <h3 className="text-lg mt-1 font-medium line-clamp-2">{post.title}</h3>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{post.metadata?.date ? formatDate(post.metadata.date) : ""}</div>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform text-gray-600 dark:text-gray-400 group-hover:text-brand-blue-dark dark:group-hover:text-brand-blue-light" />
                  </div>
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
