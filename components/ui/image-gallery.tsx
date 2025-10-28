'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  images: {
    image: {
      url: string;
      imgix_url: string;
    };
  }[];
  layout?: 'thumbnail' | 'grid' | 'carousel';
  className?: string;
}

export function ImageGallery({ images, layout = 'thumbnail', className = '' }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  if (!images || images.length === 0) {
    return null;
  }

  const selectedImage = images[selectedImageIndex];

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = carouselRef.current.clientWidth * 0.8;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Grid Layout
  if (layout === 'grid') {
    return (
      <div className={`w-full grid grid-cols-2 md:grid-cols-3 gap-4 ${className}`}>
        {images.map((image, index) => (
          <div key={index} className='relative w-full aspect-square'>
            <Image
              src={image.image.imgix_url}
              alt={`Gallery image ${index + 1}`}
              fill
              className='object-cover border border-almostblack dark:border-white'
            />
          </div>
        ))}
      </div>
    );
  }

  // Carousel Layout
  if (layout === 'carousel') {
    return (
      <div className={`w-full relative ${className}`}>
        <div
          ref={carouselRef}
          className='flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide pb-4'
        >
          {images.map((image, index) => (
            <div
              key={index}
              className='relative shrink-0 w-[80%] md:w-[60%] aspect-video snap-center'
            >
              <Image
                src={image.image.imgix_url}
                alt={`Gallery image ${index + 1}`}
                fill
                className='object-cover border border-almostblack dark:border-white'
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button
              onClick={() => scrollCarousel('left')}
              className='absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-black/80 p-2 rounded-full hover:bg-white dark:hover:bg-black transition-colors'
              aria-label='Previous image'
            >
              <ChevronLeft className='w-6 h-6' />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className='absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-black/80 p-2 rounded-full hover:bg-white dark:hover:bg-black transition-colors'
              aria-label='Next image'
            >
              <ChevronRight className='w-6 h-6' />
            </button>
          </>
        )}
      </div>
    );
  }

  // Thumbnail Layout (default)
  return (
    <div className={`w-full ${className}`}>
      {/* Main Image */}
      <div className='relative w-full mb-4'>
        <Image
          src={selectedImage.image.imgix_url}
          alt={`Gallery image ${selectedImageIndex + 1}`}
          width={0}
          height={0}
          style={{ width: '100%', height: 'auto' }}
          className='object-contain border border-almostblack dark:border-white'
        />
      </div>

      {/* Thumbnail Navigation */}
      {images.length > 1 && (
        <div className='flex gap-2 overflow-x-auto pb-2'>
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={`shrink-0 relative w-20 h-20 border transition-all ${index === selectedImageIndex ? 'border-almostblack dark:border-white opacity-100' : 'border-gray-300 dark:border-gray-600 opacity-70 hover:opacity-90'}`}
            >
              <Image
                src={image.image.imgix_url}
                alt={`Gallery thumbnail ${index + 1}`}
                fill
                className='object-cover'
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
