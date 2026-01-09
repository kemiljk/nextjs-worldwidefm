'use client';

import Link from 'next/link';
import { CategoryTag } from './category-tag';
import { buildImgixUrl, QUALITY_PRESETS, isImgixUrl, convertToImgixUrl } from '@/lib/image-utils';

interface ArticleCardProps {
  title: string;
  slug: string;
  image: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
  categories?: Array<{ slug: string; title: string }>;
  variant?: 'default' | 'white' | 'featured';
  href?: string;
  aspectRatio?: string;
}

export function ArticleCard({
  title,
  slug,
  image,
  excerpt,
  date,
  tags,
  categories,
  variant = 'default',
  href,
  aspectRatio,
}: ArticleCardProps) {
  const borderClass = variant === 'white' ? '' : 'border-black';
  const dateTextClass = variant === 'white' ? 'text-white' : 'text-almostblack';
  const isSquare = aspectRatio === '1_1';
  const isFeatured = variant === 'featured';

  // Use categories if available, otherwise fall back to tags
  const displayTags =
    categories ||
    (tags ? tags.map(tag => ({ slug: tag.toLowerCase().replace(/\s+/g, '-'), title: tag })) : []);

  // Use custom href if provided, otherwise default to editorial page
  const linkHref = href || `/editorial/${slug}`;
  const isExternalLink = href?.startsWith('http');

  const getFeaturedContainerClasses = () => {
    if (!isFeatured) return '';
    if (isSquare) {
      return 'flex flex-col md:flex-row gap-6 md:gap-10 items-start';
    }
    return 'flex flex-col gap-6 items-start';
  };

  const getFeaturedImageClasses = () => {
    if (!isFeatured) return '';
    if (isSquare) {
      return 'w-full md:w-1/2 h-auto';
    }
    return 'w-full md:max-w-[75vw] h-auto';
  };

  const getFeaturedTextClasses = () => {
    if (!isFeatured) return 'w-[90%]';
    if (isSquare) {
      return 'w-full md:w-1/2 flex flex-col justify-center';
    }
    return 'w-full lg:w-2/3 flex flex-col justify-center';
  };

  return (
    <Link
      href={linkHref}
      className={`block group ${isFeatured ? 'w-full' : ''}`}
      {...(isExternalLink ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <div className={`relative w-full ${getFeaturedContainerClasses()}`}>
        <div className={`flex-1 relative ${getFeaturedImageClasses()}`}>
          <img
            src={
              isImgixUrl(convertToImgixUrl(image))
                ? buildImgixUrl(image, {
                    width: isFeatured ? 1200 : 600,
                    quality: isFeatured ? QUALITY_PRESETS.featured : QUALITY_PRESETS.card,
                  })
                : image
            }
            alt={title}
            className={`w-full ${isFeatured ? 'h-auto object-contain' : 'h-full object-fill'} border ${borderClass}`}
            loading='lazy'
          />
        </div>
        <div className={`pt-4 pb-4 ${getFeaturedTextClasses()}`}>
          <div
            className={`pl-1 pb-6 font-sans ${isFeatured ? 'text-[28px] md:text-[40px] lg:text-[50px] leading-none' : 'text-b2'}`}
          >
            {title}
          </div>
          {isFeatured && excerpt && (
            <p className='pl-1 pb-3 text-b3 font-sans text-almostblack dark:text-white'>
              {excerpt}
            </p>
          )}
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
