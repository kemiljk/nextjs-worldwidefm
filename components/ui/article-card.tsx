'use client';

import Link from 'next/link';
import { CategoryTag } from './category-tag';

interface ArticleCardProps {
  title: string;
  slug: string;
  image: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
  categories?: Array<{ slug: string; title: string }>;
  variant?: 'default' | 'white' | 'featured';
}

export function ArticleCard({
  title,
  slug,
  image,
  date,
  tags,
  categories,
  variant = 'default',
}: ArticleCardProps) {
  const borderClass = variant === 'white' ? '' : 'border-black';
  const dateTextClass = variant === 'white' ? 'text-white' : 'text-almostblack';

  // Use categories if available, otherwise fall back to tags
  const displayTags =
    categories ||
    (tags ? tags.map(tag => ({ slug: tag.toLowerCase().replace(/\s+/g, '-'), title: tag })) : []);

  return (
    <Link href={`/editorial/${slug}`} className='block group'>
      <div
        className={`relative w-full ${variant === 'featured' ? 'flex flex-col md:flex-row gap-6 items-start' : ''}`}
      >
        <div className={`flex-1 relative ${variant === 'featured' ? 'h-auto' : ''}`}>
          <img
            src={image}
            alt={title}
            className={`w-full ${variant === 'featured' ? 'max-h-100 h-full object-cover' : 'h-full object-fill'} border ${borderClass}`}
          />
        </div>
        <div
          className={`pt-4 pb-4 ${variant === 'featured' ? 'flex-1' : 'w-[90%]'} ${variant === 'featured' ? 'flex flex-col justify-center ' : ''}`}
        >
          <div
            className={`pl-1 pb-6 font-sans ${variant === 'featured' ? 'text-b1 md:text-[40px] leading-none' : 'text-b2'}`}
          >
            {title}
          </div>
          {date && (
            <p className={`pl-1 pb-3 text-m8 font-mono dark:text-white ${dateTextClass}`}>
              {new Date(date)
                .toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                })
                .replace(/\//g, '.')}
            </p>
          )}
          {displayTags && displayTags.length > 0 && (
            <div className='flex flex-wrap'>
              {displayTags.map(tag => (
                <CategoryTag
                  key={tag.slug}
                  categorySlug={tag.slug}
                  variant={variant === 'white' ? 'white' : 'default'}
                >
                  {tag.title}
                </CategoryTag>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
