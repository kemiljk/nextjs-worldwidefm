'use client';

import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  fill?: boolean;
  sizes?: {
    mobile?: number;
    tablet?: number;
    desktop: number;
  };
  quality?: number;
}

/**
 * Optimized image component using native <picture> element with imgix params.
 * 
 * Benefits over Next.js Image:
 * - No Vercel image optimization costs
 * - Uses imgix CDN directly (already included with Cosmic)
 * - WebP/AVIF auto-format via imgix
 * - Responsive srcset generation
 * - Better control over caching
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  aspectRatio = 'auto',
  fill = false,
  sizes = { desktop: 800 },
  quality = 80,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);

  // If no src or error, show placeholder
  if (!src || hasError) {
    return (
      <img
        src="/image-placeholder.png"
        alt={alt}
        className={className}
        style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } : undefined}
      />
    );
  }

  // Check if this is an imgix URL
  const isImgix = src.includes('imgix.cosmicjs.com');
  
  // Build imgix params
  const buildImgixUrl = (baseUrl: string, w: number, extraParams: string = '') => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const params = [
      `w=${w}`,
      height ? `h=${height}` : '',
      'fit=crop',
      'auto=format,compress',
      `q=${quality}`,
      extraParams,
    ].filter(Boolean).join('&');
    return `${baseUrl}${separator}${params}`;
  };

  // Generate srcset for responsive images
  const generateSrcSet = (baseUrl: string) => {
    if (!isImgix) return undefined;
    
    const widths = [
      sizes.mobile || Math.round(sizes.desktop * 0.5),
      sizes.tablet || Math.round(sizes.desktop * 0.75),
      sizes.desktop,
      sizes.desktop * 1.5,
      sizes.desktop * 2,
    ].filter((w, i, arr) => arr.indexOf(w) === i); // Remove duplicates

    return widths
      .map(w => `${buildImgixUrl(baseUrl, w)} ${w}w`)
      .join(', ');
  };

  // Generate sizes attribute
  const generateSizes = () => {
    const parts = [];
    if (sizes.mobile) {
      parts.push(`(max-width: 640px) ${sizes.mobile}px`);
    }
    if (sizes.tablet) {
      parts.push(`(max-width: 1024px) ${sizes.tablet}px`);
    }
    parts.push(`${sizes.desktop}px`);
    return parts.join(', ');
  };

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: '',
  }[aspectRatio];

  const imgStyle = fill 
    ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const }
    : undefined;

  const finalSrc = isImgix 
    ? buildImgixUrl(src, sizes.desktop)
    : src;

  return (
    <picture className={aspectRatioClass}>
      {isImgix && (
        <>
          {/* WebP source for modern browsers */}
          <source
            type="image/webp"
            srcSet={generateSrcSet(src)}
            sizes={generateSizes()}
          />
        </>
      )}
      <img
        src={finalSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={imgStyle}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => setHasError(true)}
      />
    </picture>
  );
}

/**
 * Helper to build imgix URL with optimization params
 * Use this when you need just the URL string (e.g., for background-image)
 */
export function getOptimizedImageUrl(
  src: string | undefined,
  options: {
    width: number;
    height?: number;
    quality?: number;
    fit?: 'crop' | 'clip' | 'fill' | 'scale';
  }
): string {
  if (!src) return '/image-placeholder.png';
  
  const { width, height, quality = 80, fit = 'crop' } = options;
  const isImgix = src.includes('imgix.cosmicjs.com');
  
  if (!isImgix) return src;
  
  const separator = src.includes('?') ? '&' : '?';
  const params = [
    `w=${width}`,
    height ? `h=${height}` : '',
    `fit=${fit}`,
    'auto=format,compress',
    `q=${quality}`,
  ].filter(Boolean).join('&');
  
  return `${src}${separator}${params}`;
}

