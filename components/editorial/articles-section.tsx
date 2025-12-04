import Link from 'next/link';
import { PostObject, AuthorObject } from '@/lib/cosmic-config';
import { Card, CardContent } from '@/components/ui/card';
import { GenreTag } from '@/components/ui/genre-tag';
import { formatDate } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

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
        <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white mb-4'>
          {title}
        </h3>
        <div className='bg-gray-100 dark:bg-gray-800 p-4 rounded-none text-foreground text-center'>
          No posts available at this time.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white mb-4'>
        {title}
      </h3>
      <div className='grid grid-cols-1 gap-6'>
        {articles.map((article, index) => (
          <Link key={index} href={`/articles/${article.slug}`}>
            <Card
              ref={index === articles.length - 1 ? lastArticleRef : undefined}
              className='overflow-hidden bg-white dark:bg-gray-900 h-full flex flex-col border border-black dark:border-white rounded-none shadow-none'
            >
              <CardContent className='p-0 grow flex flex-col'>
                <div className='relative aspect-[1.1/1] w-full border-b border-black dark:border-white bg-gray-100 flex items-center justify-center'>
                  <img
                    src={article.metadata.image?.imgix_url || '/image-placeholder.png'}
                    alt={article.title}
                    className='absolute inset-0 w-full h-full object-cover'
                  />
                </div>
                <div className='flex flex-col gap-2 p-5 flex-1 justify-end'>
                  <h4 className='text-h8 font-display font-normal text-almostblack dark:text-white mb-1 text-left line-clamp-2'>
                    {article.title}
                  </h4>
                  <div className='text-m7 font-mono font-normal text-almostblack dark:text-white opacity-80 text-left'>
                    {formatDate(article.metadata.date || '')}
                    {article.metadata.author && (
                      <>
                        {' • '}
                        {typeof article.metadata.author === 'string'
                          ? article.metadata.author
                          : (article.metadata.author as AuthorObject)?.title || 'Unknown Author'}
                      </>
                    )}
                  </div>
                  {article.metadata.categories && article.metadata.categories.length > 0 && (
                    <div className='flex flex-wrap mt-2'>
                      {article.metadata.categories.map((category, idx) => (
                        <GenreTag key={idx}>{category.title}</GenreTag>
                      ))}
                    </div>
                  )}
                  {article.metadata.excerpt && (
                    <p className='text-sm text-foreground line-clamp-3 mt-2'>
                      {article.metadata.excerpt.replace(/Genre:[^.]+\.?\s*/i, '').trim()}
                    </p>
                  )}
                  <div className='mt-auto text-foreground text-sm flex items-center'>
                    Read More <ChevronRight className='h-4 w-4 ml-1' />
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
