import Image from "next/image";
import Link from "next/link";
import { ArticleObject } from "@/lib/cosmic-config";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface ArticlesSectionProps {
  title: string;
  articles: ArticleObject[];
}

export default function ArticlesSection({ title, articles }: ArticlesSectionProps) {
  console.log("ArticlesSection rendering with articles:", articles?.length);

  // If no articles, show a message instead of empty space
  if (!articles || articles.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-300 mb-4">{title}</h3>
        <div className="bg-brand-blue-light p-4 rounded-lg text-white text-center">No articles available at this time.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-300 mb-4">{title}</h3>

      <div className="grid gap-4">
        {articles.map((article) => (
          <Link key={article.id} href={`/articles/${article.slug}`}>
            <Card className="mix-blend-luminosity hover:mix-blend-normal overflow-hidden border-none shadow-md bg-brand-blue-light hover:bg-brand-blue-light/90">
              <CardContent className="p-0 flex">
                <div className="w-1/3">
                  <Image src={article.metadata.image?.imgix_url || "/placeholder.svg"} alt={article.title} width={200} height={200} className="w-full h-full object-cover" />
                </div>
                <div className="w-2/3 p-4">
                  <div className="text-sm text-gray-300 mb-1">
                    {formatDate(article.metadata.date)} • {article.metadata.author?.title || "Unknown Author"}
                  </div>
                  <h4 className="text-lg font-bold mb-2 text-white">{article.title}</h4>
                  <p className="text-sm text-gray-200 line-clamp-3">{article.metadata.excerpt}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
