import Image from "next/image";
import Link from "next/link";
import { PostObject } from "@/lib/cosmic-config";
import { format } from "date-fns";

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sortedPosts.map((post) => {
        const postDate = post.metadata?.date ? new Date(post.metadata.date) : null;
        const formattedDate = postDate ? format(postDate, "dd-MM-yyyy") : "";
        const isLarge = post.metadata.featured_size?.key === "large";
        const isMedium = post.metadata.featured_size?.key === "medium";

        return (
          <Link href={`/editorial/${post.slug}`} key={post.slug} className={`group relative ${isLarge ? "lg:col-span-2 lg:row-span-2" : isMedium ? "lg:col-span-2" : ""}`}>
            <div className="relative">
              <div className={`relative aspect-square w-full overflow-hidden`}>
                <Image src={post.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={post.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex bg-linear-to-t from-almostblack to-transparent h-1/2 flex-col p-4 flex-1 justify-end">
                <div className="bg-almostblack uppercase text-white w-fit text-h8 leading-none font-display pt-2 p-1 text-left">{formattedDate}</div>
                <h3 className="bg-white border border-almostblack text-h8 max-w-2xl leading-none font-display text-almostblack pt-2 p-1 text-left w-fit">{post.title}</h3>
                {isLarge && <p className="mt-2 text-sm line-clamp-2 text-white opacity-90">{post.metadata.excerpt}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {post.metadata.categories?.map((category) => (
                    <span key={category.slug} className="text-[10px] leading-none uppercase tracking-wider px-2 py-1 rounded-full border border-white/30 text-white">
                      {category.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
