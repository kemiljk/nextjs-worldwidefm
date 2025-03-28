import Image from "next/image";
import Link from "next/link";
import { PostObject, AuthorObject } from "@/lib/cosmic-config";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface ArticlesSectionProps {
  title: string;
  articles: PostObject[];
  lastArticleRef?: (node: HTMLDivElement) => void;
}

export default function ArticlesSection({ title, articles, lastArticleRef }: ArticlesSectionProps) {
  // If no articles, show a message instead of empty space
  if (!articles || articles.length === 0) {
    return (
      <div>
        <h3 className="text-lg leading-tight  font-medium text-gray-900 dark:text-gray-50 mb-4">{title}</h3>
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-none text-gray-600 dark:text-gray-400 text-center">No posts available at this time.</div>
      </div>
    );
  }

  return (
    <div>
      {title && <h3 className="text-lg leading-tight  font-medium text-gray-900 dark:text-gray-50 mb-4">{title}</h3>}
      <div className="grid grid-cols-1 gap-6">
        {articles.map((article, index) => (
          <Link key={index} href={`/articles/${article.slug}`}>
            <Card ref={index === articles.length - 1 ? lastArticleRef : undefined} className="overflow-hidden  hover:shadow-md transition-all duration-200 bg-tan-50/25 dark:bg-gray-900 border-sky-50">
              <CardContent className="p-0 flex flex-col md:flex-row h-full">
                <div className="relative w-full md:w-[250px] aspect-square shrink-0">
                  <Image src={article.metadata.image?.imgix_url || "/image-placeholder.svg"} alt={article.title} fill className="object-cover" />
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <div>
                    {article.metadata.categories && article.metadata.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {article.metadata.categories.map((category, index) => (
                          <Badge key={index} variant="secondary" className="bg-gray-100 uppercase dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                            {category.title}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(article.metadata.date || "")} • {typeof article.metadata.author === "string" ? article.metadata.author : (article.metadata.author as AuthorObject)?.title || "Unknown Author"}
                    </span>
                    <h4 className="text-xl font-medium mb-3 text-gray-900 dark:text-gray-50 line-clamp-2">{article.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">{article.metadata.excerpt?.replace(/Genre:[^.]+\.?\s*/i, "").trim()}</p>
                  <div className="mt-auto text-sky-500 dark:text-sky-400 font-medium text-sm flex items-center">
                    Read More <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
