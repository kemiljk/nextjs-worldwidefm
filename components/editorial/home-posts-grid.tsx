import Image from "next/image";
import Link from "next/link";
import { PostObject } from "@/lib/cosmic-config";
import { format } from "date-fns";

interface HomePostsGridProps {
  posts: PostObject[];
}

export default function HomePostsGrid({ posts }: HomePostsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {posts.map((post) => {
        const postDate = post.metadata?.date ? new Date(post.metadata.date) : null;
        const formattedDate = postDate ? format(postDate, "dd-MM-yyyy") : "";

        return (
          <Link href={`/editorial/${post.slug}`} key={post.slug} className="group">
            <div className="relative">
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image src={post.metadata?.image?.imgix_url || "/image-placeholder.svg"} alt={post.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="mt-2">
                <div className="text-xs leading-none uppercase text-foreground mb-1">{formattedDate}</div>
                <h3 className="text-m7 font-mono font-normal text-almostblack transition-colors line-clamp-2">{post.title}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {post.metadata.categories?.map((category) => (
                    <span key={category.slug} className="text-[9.5px] leading-1 uppercase px-2 py-1 rounded-full border border-black dark:border-white">
                      {category.title}
                    </span>
                  ))}
                </div>
                <div className="text-xs leading-none uppercase text-foreground mt-2">By {typeof post.metadata.author === "string" ? post.metadata.author : post.metadata.author?.title || "WWFM"}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
