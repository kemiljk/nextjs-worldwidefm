import Image from "next/image";
import Link from "next/link";
import { PostObject } from "@/lib/cosmic-config";
import { format } from "date-fns";
import PostsGrid from "./posts-grid";
import HomePostsGrid from "./home-posts-grid";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface EditorialSectionProps {
  title: string;
  posts: PostObject[];
  layout?: "grid" | "list";
  className?: string;
  isHomepage?: boolean;
}

export default function EditorialSection({ title, posts, layout = "grid", className, isHomepage = false }: EditorialSectionProps) {
  if (!posts.length) return null;

  return (
    <div className={cn("", className)}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-medium text-sky-900">{title}</h2>
        {isHomepage && (
          <Link href="/editorial" className="text-sm text-sky-900 flex items-center group">
            View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>

      {isHomepage ? (
        <HomePostsGrid posts={posts} />
      ) : layout === "grid" ? (
        <PostsGrid initialPosts={posts} />
      ) : (
        <div className="space-y-8">
          {posts.map((post) => {
            const postDate = post.metadata?.date ? new Date(post.metadata.date) : null;
            const formattedDate = postDate ? format(postDate, "dd-MM-yyyy") : "";

            return (
              <Link href={`/editorial/${post.slug}`} key={post.slug} className="group flex gap-6 items-start hover:bg-white/50 dark:hover:bg-white/5 p-4 -mx-4 rounded-lg transition-colors">
                <div className="relative aspect-[4/3] w-72 flex-shrink-0 overflow-hidden">
                  <Image src={post.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={post.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="flex-grow pt-2">
                  <div className="font-mono text-[12px] leading-none uppercase tracking-wider text-muted-foreground mb-2">{formattedDate}</div>
                  <h3 className="text-xl font-medium group-hover:text-sky-50 transition-colors mb-2">{post.title}</h3>
                  <p className="text-muted-foreground line-clamp-2 mb-3">{post.metadata.excerpt}</p>
                  <div className="flex flex-wrap gap-2">
                    {post.metadata.categories?.map((category) => (
                      <span key={category.slug} className="font-mono text-[10px] leading-none uppercase tracking-wider px-2 py-1 rounded-full border border-bronze-900 dark:border-bronze-50">
                        {category.title}
                      </span>
                    ))}
                  </div>
                  {post.metadata.author && <div className="font-mono text-[10px] leading-none uppercase tracking-wider text-muted-foreground mt-3">By {typeof post.metadata.author === "string" ? post.metadata.author : post.metadata.author.title || "Unknown"}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
