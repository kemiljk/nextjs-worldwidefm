import React from 'react';
import { ProcessedHomepageSection, CosmicItem, ColouredSection } from '@/lib/cosmic-types';
import UniqueHomepageSection from './unique-homepage-section';
import { ResponsiveCardImage } from '@/components/ui/optimized-image';

// Reusable Item Card (similar to the one in HomepageHero, could be centralized)
const SectionItemCard: React.FC<{ item: CosmicItem }> = ({ item }) => {
  // Check external_image_url first (cold storage for old episodes)
  const imageUrl =
    item.metadata?.external_image_url ||
    item.metadata?.image?.imgix_url || 
    item.metadata?.image?.url || 
    '/image-placeholder.png';
  const title = item.title || 'Untitled';
  const subtitle = item.metadata?.subtitle || '';
  const description = item.metadata?.description || '';
  const date = item.metadata?.date || '';

  return (
    <div className='border border-almostblack dark:border-white overflow-hidden'>
      <div className='aspect-square relative overflow-hidden'>
        <ResponsiveCardImage
          src={imageUrl}
          alt={title}
          className='object-cover'
          sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw'
          aspectRatio='square'
        />
      </div>
      <div className='p-4'>
        <h3 className='font-mono text-2xl text-almostblack dark:text-white mb-1 line-clamp-2'>
          {title}
        </h3>
        {subtitle && (
          <p className='font-body text-sm text-almostblack dark:text-white mb-2 line-clamp-1'>
            {subtitle}
          </p>
        )}
        {description && (
          <p className='font-body text-sm text-almostblack dark:text-white mb-2 line-clamp-2'>
            {description}
          </p>
        )}
        {date && <p className='font-mono text-xs text-almostblack dark:text-white'>{date}</p>}
      </div>
    </div>
  );
};

interface CosmicSectionProps {
  section: ProcessedHomepageSection;
  colouredSection?: ColouredSection; // Optional coloured section data
}

const CosmicSectionComponent: React.FC<CosmicSectionProps> = ({ section, colouredSection }) => {
  if (!section.is_active || !section.items || section.items.length === 0) {
    return null;
  }

  // Handle unique sections with special styling
  if (section.layout === 'Unique') {
    return <UniqueHomepageSection section={section} colouredSection={colouredSection} />;
  }

  return (
    <section className='py-8 md:py-12 lg:py-16 px-5'>
      <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white mb-6 md:mb-8'>
        {section.title}
      </h2>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {section.items.map(item => (
          <SectionItemCard key={item.slug} item={item} />
        ))}
      </div>
    </section>
  );
};

export default CosmicSectionComponent;
