import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getEditorialHomepage, getPosts } from "@/lib/cosmic-service";
import WatchAndListenSection from "@/components/editorial/watch-and-listen-section";
import PostsGrid from "@/components/editorial/posts-grid";

export default async function EditorialPage() {
  // Fetch editorial homepage data which includes featured items
  const editorialResponse = await getEditorialHomepage();
  const editorial = editorialResponse.object;

  // Fetch initial posts
  const postsResponse = await getPosts({
    limit: 12,
    sort: "-metadata.date",
  });
  const posts = postsResponse.objects || [];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-medium text-gray-900 dark:text-gray-50">Posts</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Discover our latest articles, features, and stories.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-brand-orange transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gray-900 dark:text-gray-50">Posts</span>
          </div>
        </div>

        {/* Featured Content */}
        {editorial && (
          <div className="mb-16">
            <WatchAndListenSection title="Featured Content" albumOfTheWeek={editorial.metadata.featured_album} events={editorial.metadata.featured_event} video={editorial.metadata.featured_video} />
          </div>
        )}

        {/* Posts Grid */}
        {posts.length > 0 ? (
          <div>
            <h2 className="text-2xl font-medium mb-8 text-gray-900 dark:text-gray-50">Latest Posts</h2>
            <PostsGrid initialPosts={posts} />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600 dark:text-gray-400">No posts found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
