import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getArticles } from "@/lib/cosmic-service";
import { formatDate } from "@/lib/utils";

export default async function ArticlesPage() {
  // Fetch all articles
  const articlesResponse = await getArticles({
    limit: 20,
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link key={article.id} href={`/articles/${article.slug}`}>
              <Card className="overflow-hidden border-none shadow-md h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-0 flex flex-col h-full">
                  <div className="relative aspect-video w-full">
                    <Image src={article.metadata.image?.imgix_url || "/placeholder.svg"} alt={article.title} fill className="object-cover" />
                  </div>
                  <div className="p-5 flex-grow flex flex-col">
                    <div className="text-sm text-muted-foreground mb-2">
                      {formatDate(article.metadata.date)} • {article.metadata.author?.title || "Unknown Author"}
                    </div>
                    <h2 className="text-xl font-medium mb-2">{article.title}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{article.metadata.excerpt}</p>
                    <div className="mt-auto text-brand-orange font-medium text-sm flex items-center">
                      Read More <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">No articles found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
