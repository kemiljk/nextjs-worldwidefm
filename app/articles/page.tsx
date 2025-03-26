import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getArticles } from "@/lib/cosmic-service";
import { formatDate } from "@/lib/utils";
import InfiniteArticles from "@/components/editorial/infinite-articles";

export default async function ArticlesPage() {
  // Fetch initial articles
  const articlesResponse = await getArticles({
    limit: 12,
    sort: "-metadata.date",
  });

  const articles = articlesResponse.objects || [];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto pt-32 pb-32">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-medium">Articles</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-brand-orange transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Articles</span>
          </div>
        </div>

        {articles.length > 0 ? (
          <InfiniteArticles title="All Posts" initialArticles={articles} />
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">No articles found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
