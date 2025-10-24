'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ImageGalleryProps {
  images: {
    image: {
      url: string;
      imgix_url: string;
    };
  }[];
  className?: string;
}

export function ImageGallery({ images, className = '' }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  const selectedImage = images[selectedImageIndex];

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
          className='object-contain border-1 border-almostblack dark:border-white'
        />
      </div>

      {/* Thumbnail Navigation */}
      {images.length > 1 && (
        <div className='flex gap-2 overflow-x-auto pb-2'>
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={`flex-shrink-0 relative w-20 h-20 border-1 transition-all ${index === selectedImageIndex ? 'border-almostblack dark:border-white opacity-100' : 'border-gray-300 dark:border-gray-600 opacity-70 hover:opacity-90'}`}
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
