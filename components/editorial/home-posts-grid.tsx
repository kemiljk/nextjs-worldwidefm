import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PostObject } from "@/lib/cosmic-config";
import { formatDate } from "@/lib/utils";

interface HomePostsGridProps {
  posts: PostObject[];
}

export default function HomePostsGrid({ posts }: HomePostsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {posts.map((post, index) => {
        const key = `${post.id}-${index}`;
        const postType = "article"; // Default to article type since we don't have post_type in metadata

        return (
          <Link key={key} href={`/${postType}s/${post.slug}`}>
            <div className="group">
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-none">
                <Image src={post.metadata?.image?.imgix_url || "/placeholder.svg"} alt={post.title} fill className="object-cover" />
                <div className="absolute top-6 left-6 bg-black text-white text-xs px-3 py-1 uppercase tracking-wider">{postType}</div>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">WWFM</div>
                <h3 className="text-lg leading-tight  mt-2 font-medium line-clamp-2">{post.title}</h3>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">{post.metadata?.date ? formatDate(post.metadata.date) : ""}</div>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform text-gray-600 dark:text-gray-400 group-hover:text-brand-blue-dark dark:group-hover:text-brand-blue-light" />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
