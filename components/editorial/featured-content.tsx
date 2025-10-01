import Image from "next/image";
import Link from "next/link";
import { PostObject } from "@/lib/cosmic-config";
import { GenreTag } from "@/components/ui/genre-tag";
import { HighlightedText } from "@/components/ui/highlighted-text";
import { format } from "date-fns";
import { ArticleCard } from "@/components/ui/article-card";

interface FeaturedContentProps {
  posts: PostObject[];
}

export default function FeaturedContent({ posts }: FeaturedContentProps) {
  if (!posts.length) return null;

  // Sort posts by featured_size if available
  const sortedPosts = [...posts].sort((a, b) => {
    const aSize = a.metadata.featured_size?.key === "large" ? 3 : a.metadata.featured_size?.key === "medium" ? 2 : 1;
    const bSize = b.metadata.featured_size?.key === "large" ? 3 : b.metadata.featured_size?.key === "medium" ? 2 : 1;
    return bSize - aSize;
  });

  return (
    <div className="my-4 w-full px-5 items-center justify-center flex bg-almostblack/10">
    <div className="">
      <ArticleCard
        key={sortedPosts[0].slug}
        slug={sortedPosts[0].slug}
        title={sortedPosts[0].title}
        date={sortedPosts[0].metadata?.date}
        excerpt={sortedPosts[0].metadata?.excerpt}
        image={sortedPosts[0].metadata?.image?.imgix_url || "/image-placeholder.svg"}
        tags={sortedPosts[0].metadata.categories?.map((c) => c.title)}
        size={sortedPosts[0].metadata.featured_size?.key}
        variant="featured"
      />
    </div>
  </div>);
}
