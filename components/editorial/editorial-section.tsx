import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PostObject } from "@/lib/cosmic-config";
import PostsGrid from "./posts-grid";
import { cn } from "@/lib/utils";

interface EditorialSectionProps {
  title?: string;
  posts: PostObject[];
  className?: string;
}

export default function EditorialSection({ title = "POSTS", posts, className = "mb-12 z-10" }: EditorialSectionProps) {
  return (
    <section className={cn("", className)}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-medium text-brand-blue-dark">{title}</h2>
        <Link href="/editorial" className="text-sm text-muted-foreground flex items-center group">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <PostsGrid initialPosts={posts} />
    </section>
  );
}
