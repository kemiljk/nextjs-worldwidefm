"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ArticleObject } from "@/lib/cosmic-config";
import ArticlesSection from "./articles-section";
import { getArticles } from "@/lib/cosmic-service";

interface InfiniteArticlesProps {
  initialArticles: ArticleObject[];
  title: string;
}

export default function InfiniteArticles({ initialArticles, title }: InfiniteArticlesProps) {
  const [articles, setArticles] = useState<ArticleObject[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const lastArticleRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const loadMore = async () => {
    try {
      setLoading(true);
      const response = await getArticles({
        limit: 12,
        skip: articles.length,
        sort: "-metadata.date",
      });

      const newArticles = response.objects || [];
      if (newArticles.length > 0) {
        setArticles((prev) => [...prev, ...newArticles]);
        setHasMore(newArticles.length === 12); // If we got less than 12, we've reached the end
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more articles:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ArticlesSection title={title} articles={articles} lastArticleRef={lastArticleRef} />
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
        </div>
      )}
    </div>
  );
}
