import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getAllPosts } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { PostObject } from "@/lib/cosmic-config";

interface Post extends PostObject {}

interface EditorialSectionProps {
  title: string;
  posts: Post[];
  className?: string;
  isHomepage?: boolean;
  layout?: "grid" | "list";
}

export default function EditorialSection({ title, posts, className, isHomepage = false }: EditorialSectionProps) {
  return (
    <section className={cn("", className)}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-medium text-sky-50">{title}</h2>
        <Link href="/posts" className="text-sm text-sky-50 flex items-center group">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      <div className="flex overflow-x-auto hide-scrollbar gap-6 pb-4 -mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24">
        {posts.map((post) => (
          <Link key={post.id} href={`/posts/${post.slug}`} className="flex-none w-[300px]">
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
      </div>
    </section>
  );
}
