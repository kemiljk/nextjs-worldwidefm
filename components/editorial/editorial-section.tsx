import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PostObject } from "@/lib/cosmic-config";
import PostsGrid from "./posts-grid";
import HomePostsGrid from "./home-posts-grid";
import { cn } from "@/lib/utils";

interface EditorialSectionProps {
  title?: string;
  posts: PostObject[];
  className?: string;
  isHomepage?: boolean;
}

export default function EditorialSection({ title = "POSTS", posts, className = "mb-12 z-10", isHomepage = false }: EditorialSectionProps) {
  return (
    <section className={cn("", className)}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-medium text-brand-blue-dark">{title}</h2>
        <Link href="/editorial" className="text-sm text-brand-blue-dark flex items-center group">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {isHomepage ? <HomePostsGrid posts={posts} /> : <PostsGrid initialPosts={posts} />}
    </section>
  );
}
