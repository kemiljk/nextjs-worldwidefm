'use client';

import React from 'react';
import { ShowCard } from '@/components/ui/show-card';
import { HighlightedText } from '@/components/ui/highlighted-text';
import { ProcessedHomepageSection, CosmicItem, ColouredSection } from '@/lib/cosmic-types';

interface UniqueHomepageSectionProps {
  section: ProcessedHomepageSection;
  colouredSection?: ColouredSection;
}

const UniqueHomepageSection: React.FC<UniqueHomepageSectionProps> = ({
  section,
  colouredSection,
}) => {
  if (!section.is_active || !section.items || section.items.length === 0) {
    return null;
  }

  // Colors are now assigned sequentially in the parent component
  const sectionColor = section.color || 'bg-sunset';

  // Data is already transformed by createColouredSections, so use it directly
  const shows = section.items.map((item: CosmicItem) => {
    return {
      ...item,
      key: item.slug,
    };
  });

  const displayTitle = colouredSection?.title || section.title;
  const displayTime = colouredSection?.time || section.subtitle || '';
  const displayDescription = colouredSection?.description || section.description || '';

  return (
    <section className='relative w-full h-full overflow-visible'>
      <div className='absolute inset-0' style={{ backgroundColor: sectionColor }} />

      <div
        className='absolute inset-0 w-full bg-linear-to-b from-white via-white/0 to-white'
        style={{ mixBlendMode: 'hue' }}
      />

      <div
        className='absolute inset-0'
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          mixBlendMode: 'screen',
        }}
      />

      <div className='relative flex flex-col gap-6 p-5'>
        <div className='grid grid-cols-2 md:grid-cols-5 gap-3 overflow-hidden'>
          {shows.map((show, index) => (
            <div
              key={show.key || index}
              className={`
             flex 
              ${index >= 4 ? 'hidden md:flex' : ''}  /* hide 5+ on mobile */
              ${index >= 10 ? 'hidden xl:flex' : ''}  /* hide 11+ on xl and below */
            `}
            >
              <ShowCard
                show={show}
                slug={`/episode/${show.slug}`}
                playable
                className='w-full border-almostblack cursor-default'
                variant='light'
              />
            </div>
          ))}
        </div>

        <div className='flex items-center'>
          <div className='flex flex-col gap-4 w-full pb-5'>
            <div className='flex flex-row justify-between w-full items-start'>
              <div className='flex flex-wrap items- gap-0 w-full pt-1 pr-3'>
                <h2 className='font-display text-h8 sm:text-h7 leading-none uppercase tracking-tight'>
                  <HighlightedText variant='default'>{displayTitle}</HighlightedText>
                </h2>
                {displayTime && (
                  <h3 className='font-display text-h8 sm:text-h7 leading-none uppercase tracking-tight wrap-break-word'>
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
              <div className='text-left'>
                <a
                  href={`/${section.type}`}
                  className='font-mono text-m8 sm:text-m7 text-almostblack uppercase hover:underline transition-all break-none whitespace-nowrap'
                >
                  SEE ALL &gt;
                </a>
              </div>
            </div>
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
