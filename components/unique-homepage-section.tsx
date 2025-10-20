'use client';

import React from 'react';
import { ShowCard } from '@/components/ui/show-card';
import { HighlightedText } from '@/components/ui/highlighted-text';
import { ProcessedHomepageSection, CosmicItem, ColouredSection } from '@/lib/cosmic-types';

interface UniqueHomepageSectionProps {
  section: ProcessedHomepageSection;
  colouredSection?: ColouredSection; // Optional coloured section data
}

const UniqueHomepageSection: React.FC<UniqueHomepageSectionProps> = ({
  section,
  colouredSection,
}) => {
  if (!section.is_active || !section.items || section.items.length === 0) {
    return null;
  }

  // Colors are now assigned sequentially in the parent component
  // Fallback to orange if no color is provided
  const sectionColor = section.color || 'bg-sunset';

  // Convert Cosmic items to show format for ShowCard
  const convertToShowFormat = (item: CosmicItem) => {
    if (item.type === 'regular-hosts') {
      return {
        key: item.slug,
        name: item.title,
        url: `/hosts/${item.slug}`,
        slug: item.slug,
        pictures: {
          large:
            item.metadata.image?.url || item.metadata.image?.imgix_url || '/image-placeholder.svg',
        },
        user: {
          name: item.title,
          username: item.slug,
        },
        created_time: item.metadata.created_time || item.metadata.date || '',
        tags: item.metadata.tags || item.metadata.categories || [],
        description: item.metadata.description || '',
      };
    }

    // Handle other item types (episodes, posts, etc.)
    if (item.type === 'episodes') {
      const imageUrl =
        item.metadata.image?.imgix_url ||
        item.metadata.image?.url ||
        item.metadata.featured_image?.imgix_url;
      return {
        // core identity
        key: item.slug,
        name: item.title,
        slug: item.slug,
        url: `/episode/${item.slug}`,
        // media
        pictures: {
          large: imageUrl || '/image-placeholder.svg',
          extra_large: imageUrl || '/image-placeholder.svg',
        },
        enhanced_image: imageUrl,
        // dates
        broadcast_date: item.metadata.broadcast_date || item.metadata.date || '',
        broadcast_time: item.metadata.broadcast_time || '',
        created_time:
          item.metadata.created_time || item.metadata.broadcast_date || item.metadata.date || '',
        // meta for ShowCard
        metadata: item.metadata,
        genres: item.metadata.genres || [],
        locations: item.metadata.locations || [],
        regular_hosts: item.metadata.regular_hosts || [],
        takeovers: item.metadata.takeovers || [],
        player: item.metadata.player,
        description: item.metadata.description || item.metadata.excerpt || '',
        tags: (item.metadata.genres || [])
          .map((g: any) => ({ name: g.title, title: g.title, id: g.id, slug: g.slug }))
          .filter(Boolean),
        __source: 'episode',
      };
    }

    // Posts and other content types
    return {
      key: item.slug,
      name: item.title,
      url: item.type === 'posts' ? `/editorial/${item.slug}` : `/${item.type}/${item.slug}`,
      slug: item.slug,
      pictures: {
        large:
          item.metadata.image?.url ||
          item.metadata.featured_image?.imgix_url ||
          '/image-placeholder.svg',
      },
      user: {
        name: item.metadata.author?.title || item.metadata.author || '',
        username: item.metadata.author?.title || item.metadata.author || '',
      },
      created_time: item.metadata.date || item.metadata.created_time || '',
      tags: (item.metadata.categories || item.metadata.tags || [])
        .map((cat: any) => {
          if (typeof cat === 'string') return cat;
          if (cat && typeof cat === 'object' && 'title' in cat && typeof cat.title === 'string')
            return cat.title;
          return '';
        })
        .filter((tag: string) => !!tag),
      excerpt: item.metadata.excerpt || '',
    };
  };

  const shows = section.items.map(convertToShowFormat);

  // Use coloured section data if available, otherwise fall back to section data
  const displayTitle = colouredSection?.title || section.title;
  const displayTime = colouredSection?.time || section.subtitle || '';
  const displayDescription = colouredSection?.description || section.description || '';

  return (
    <section className='relative w-full h-full overflow-visible'>
      {/* Solid Color Background*/}
      <div
        className='absolute inset-0'
        style={{ backgroundColor: sectionColor }}
      />

      {/*Linear white gradient*/}
      <div
        className='absolute inset-0 w-full bg-gradient-to-b from-white via-white/0 to-white'
        style={{ mixBlendMode: 'hue' }}
      />

      {/* Noise Overlay */}
      <div
        className='absolute inset-0'
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          mixBlendMode: 'screen',
        }}
      />

      {/* Content Container */}
      <div className='relative flex flex-col gap-6 p-5'>
        {/* Shows Grid */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-3 overflow-hidden'>
          {shows.map((show, index) => (
            <div
              key={show.key || index}
              className={`
             flex 
              ${index >= 4 ? 'hidden md:flex' : ''}  /* hide 6+ on md and below */
              ${index >= 8 ? 'hidden xl:flex' : ''}  /* hide 8+ on xl and below */
            `}
            >
              <ShowCard
                show={show}
                slug={show.url}
                playable
                className='w-full border-almostblack cursor-default'
                variant='light'
              />
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className='flex items-center'>
          {/* Main Title */}
          <div className='flex flex-col gap-4 w-full pb-5'>
            <div className='flex flex-row justify-between w-full items-start'>
              <div className='flex flex-wrap items- gap-0 w-full pt-1 pr-3'>
                <h2 className='font-display text-h8 sm:text-h7 leading-none uppercase tracking-tight'>
                  <HighlightedText variant='default'>{displayTitle}</HighlightedText>
                </h2>
                {/* Subtitle with color background */}
                {displayTime && (
                  <h3 className='font-display text-h8 sm:text-h7 leading-none uppercase tracking-tight break-words'>
                    <HighlightedText
                      variant='custom'
                      backgroundColor={sectionColor}
                      textColor='var(--color-almostblack)'
                    >
                      {displayTime}
                    </HighlightedText>
                  </h3>
                )}
              </div>
              {/* See All Link */}
              <div className='text-left'>
                <a
                  href={`/${section.type}`}
                  className='font-mono text-m8 sm:text-m7 text-almostblack uppercase hover:underline transition-all break-none whitespace-nowrap'
                >
                  SEE ALL &gt;
                </a>
              </div>
            </div>
            {/* Description */}
            {displayDescription && (
              <div className='max-w-80'>
                <p className='font-body text-b4 md:text-b3 text-almostblack'>
                  {displayDescription}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UniqueHomepageSection;
