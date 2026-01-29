'use client';

import { useState, useMemo } from 'react';
import {
  buildImgixUrl,
  generateSrcSet,
  isImgixUrl,
  convertToImgixUrl,
  QUALITY_PRESETS,
  SRCSET_CONFIGS,
} from '@/lib/image-utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  fill?: boolean;
  sizes?: string;
  quality?: 'thumbnail' | 'card' | 'featured' | 'hero' | 'gallery' | number;
  variant?: 'thumbnail' | 'card' | 'hero' | 'video' | 'featured';
  onError?: () => void;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Optimized image component using native <picture> element with imgix params.
 *
 * Key optimizations for bandwidth savings:
 * - Auto WebP/AVIF format detection via imgix
 * - Aggressive quality compression (55-75 range)
 * - Responsive srcset generation
 * - Lazy loading by default
 * - Metadata stripping
 * - No Vercel image optimization costs
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
  sizes,
  quality,
  variant = 'card',
  onError,
  onClick,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Determine quality based on variant or explicit quality prop
  const qualityValue = useMemo(() => {
    if (typeof quality === 'number') return quality;
    if (quality && quality in QUALITY_PRESETS)
      return QUALITY_PRESETS[quality as keyof typeof QUALITY_PRESETS];
    if (variant in QUALITY_PRESETS) return QUALITY_PRESETS[variant as keyof typeof QUALITY_PRESETS];
    return QUALITY_PRESETS.card;
  }, [quality, variant]);

  // Get srcset config based on variant
  const srcsetWidths = useMemo(() => {
    switch (variant) {
      case 'thumbnail':
        return SRCSET_CONFIGS.thumbnail;
      case 'hero':
        return SRCSET_CONFIGS.hero;
      case 'video':
        return SRCSET_CONFIGS.video;
      case 'featured':
        return SRCSET_CONFIGS.featured;
      default:
        return SRCSET_CONFIGS.card;
    }
  }, [variant]);

  // Default sizes attribute based on variant
  const defaultSizes = useMemo(() => {
    switch (variant) {
      case 'thumbnail':
        return '100px';
      case 'hero':
        return '100vw';
      case 'video':
        return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
      case 'featured':
        return '(max-width: 768px) 100vw, 50vw';
      default:
        return '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';
    }
  }, [variant]);

  // Calculate aspect ratio for height
  const aspectRatioValue = useMemo(() => {
    switch (aspectRatio) {
      case 'square':
        return 1;
      case 'video':
        return 9 / 16;
      case 'portrait':
        return 4 / 3;
      default:
        return undefined;
    }
  }, [aspectRatio]);

  // If no src or error, show placeholder
  if (!src || hasError) {
    return (
      <img
        src='/image-placeholder.png'
        alt={alt}
        className={className}
        style={
          fill
            ? {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }
            : undefined
        }
        onClick={onClick}
      />
    );
  }

  // Check if this is an imgix URL
  const normalizedSrc = convertToImgixUrl(src);
  const canOptimize = isImgixUrl(normalizedSrc);

  // Build the main image URL
  const mainWidth = srcsetWidths[srcsetWidths.length - 1] || 800;
  const mainHeight = aspectRatioValue ? Math.round(mainWidth * aspectRatioValue) : undefined;

  const finalSrc = canOptimize
    ? buildImgixUrl(normalizedSrc, {
        width: mainWidth,
        height: mainHeight,
        quality: qualityValue,
        fit: 'crop',
      })
    : src;

  // Generate srcset
  const srcSet = canOptimize
    ? generateSrcSet(normalizedSrc, {
        widths: srcsetWidths,
        quality: qualityValue,
        aspectRatio: aspectRatioValue,
        fit: 'crop',
      })
    : undefined;

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: '',
  }[aspectRatio];

  const imgStyle = fill
    ? {
        position: 'absolute' as const,
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
      }
    : undefined;

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <picture className={aspectRatioClass}>
      {canOptimize && srcSet && (
        <source type='image/webp' srcSet={srcSet} sizes={sizes || defaultSizes} />
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
        onError={handleError}
        onLoad={() => setIsLoaded(true)}
        onClick={onClick}
      />
    </picture>
  );
}

/**
 * Simple image component for when you just need a basic optimized img tag
 * Useful for replacing Next.js Image in simple cases
 */
export function SimpleOptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 'card',
  onError,
}: {
  src: string;
  alt: string;
  width: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: 'thumbnail' | 'card' | 'featured' | 'hero' | 'gallery' | number;
  onError?: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  const qualityValue = typeof quality === 'number' ? quality : QUALITY_PRESETS[quality];

  if (!src || hasError) {
    return (
      <img
        src='/image-placeholder.png'
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  const normalizedSrc = convertToImgixUrl(src);
  const canOptimize = isImgixUrl(normalizedSrc);

  const finalSrc = canOptimize
    ? buildImgixUrl(normalizedSrc, { width, height, quality: qualityValue, fit: 'crop' })
    : src;

  return (
    <img
      src={finalSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => {
        setHasError(true);
        onError?.();
      }}
    />
  );
}

/**
 * Helper to build imgix URL with optimization params
 * Use this when you need just the URL string (e.g., for background-image)
 *
 * @deprecated Use buildImgixUrl from '@/lib/image-utils' instead
 */
export function getOptimizedImageUrl(
  src: string | undefined,
  options: {
    width: number;
    height?: number;
    quality?: number;
    fit?: 'crop' | 'clip' | 'fill' | 'scale' | 'max';
  }
): string {
  if (!src) return '/image-placeholder.png';

  const { width, height, quality = QUALITY_PRESETS.card, fit = 'crop' } = options;
  const normalizedSrc = convertToImgixUrl(src);

  if (!isImgixUrl(normalizedSrc)) return src;

  return buildImgixUrl(normalizedSrc, { width, height, quality, fit });
}

/**
 * Responsive image component with srcset for different screen sizes
 * Ideal for cards and grid layouts
 */
export function ResponsiveCardImage({
  src,
  alt,
  className = '',
  priority = false,
  aspectRatio = 'square',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait';
  sizes?: string;
  onError?: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  const aspectRatioValue = {
    square: 1,
    video: 9 / 16,
    portrait: 4 / 3,
  }[aspectRatio];

  if (!src || hasError) {
    return (
      <img
        src='/image-placeholder.png'
        alt={alt}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }

  const normalizedSrc = convertToImgixUrl(src);
  const canOptimize = isImgixUrl(normalizedSrc);

  // Use card sizes: 400, 600, 800
  const widths = SRCSET_CONFIGS.card;
  const mainWidth = widths[widths.length - 1];
  const mainHeight = Math.round(mainWidth * aspectRatioValue);

  const finalSrc = canOptimize
    ? buildImgixUrl(normalizedSrc, {
        width: mainWidth,
        height: mainHeight,
        quality: QUALITY_PRESETS.card,
        fit: 'crop',
      })
    : src;

  const srcSet = canOptimize
    ? generateSrcSet(normalizedSrc, {
        widths,
        quality: QUALITY_PRESETS.card,
        aspectRatio: aspectRatioValue,
        fit: 'crop',
      })
    : undefined;

  return (
    <picture>
      {canOptimize && srcSet && <source type='image/webp' srcSet={srcSet} sizes={sizes} />}
      <img
        src={finalSrc}
        alt={alt}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => {
          setHasError(true);
          onError?.();
        }}
      />
    </picture>
  );
}

/**
 * Hero image component optimized for full-width displays
 */
export function HeroImage({
  src,
  alt,
  className = '',
  priority = true,
  aspectRatio,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  aspectRatio?: number; // height/width, e.g., 0.5625 for 16:9
  onError?: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <img
        src='/image-placeholder.png'
        alt={alt}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }

  const normalizedSrc = convertToImgixUrl(src);
  const canOptimize = isImgixUrl(normalizedSrc);

  // Hero sizes: 768, 1024, 1400, 1920
  const widths = SRCSET_CONFIGS.hero;
  const mainWidth = widths[widths.length - 1];
  const mainHeight = aspectRatio ? Math.round(mainWidth * aspectRatio) : undefined;

  const finalSrc = canOptimize
    ? buildImgixUrl(normalizedSrc, {
        width: mainWidth,
        height: mainHeight,
        quality: QUALITY_PRESETS.hero,
        fit: 'crop',
      })
    : src;

  const srcSet = canOptimize
    ? generateSrcSet(normalizedSrc, {
        widths,
        quality: QUALITY_PRESETS.hero,
        aspectRatio,
        fit: 'crop',
      })
    : undefined;

  return (
    <picture>
      {canOptimize && srcSet && <source type='image/webp' srcSet={srcSet} sizes='100vw' />}
      <img
        src={finalSrc}
        alt={alt}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => {
          setHasError(true);
          onError?.();
        }}
      />
    </picture>
  );
}

/**
 * Video thumbnail image component
 */
export function VideoThumbnailImage({
  src,
  alt,
  className = '',
  priority = false,
  large = false,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  large?: boolean;
  onError?: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <img
        src='/image-placeholder.png'
        alt={alt}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }

  const normalizedSrc = convertToImgixUrl(src);
  const canOptimize = isImgixUrl(normalizedSrc);

  // Video thumbnail: 16:9 aspect ratio
  const aspectRatioValue = 9 / 16;
  const widths = SRCSET_CONFIGS.video;
  const mainWidth = large ? widths[widths.length - 1] : widths[1];
  const mainHeight = Math.round(mainWidth * aspectRatioValue);

  const finalSrc = canOptimize
    ? buildImgixUrl(normalizedSrc, {
        width: mainWidth,
        height: mainHeight,
        quality: QUALITY_PRESETS.card,
        fit: 'crop',
      })
    : src;

  const srcSet = canOptimize
    ? generateSrcSet(normalizedSrc, {
        widths,
        quality: QUALITY_PRESETS.card,
        aspectRatio: aspectRatioValue,
        fit: 'crop',
      })
    : undefined;

  return (
    <picture>
      {canOptimize && srcSet && (
        <source
          type='image/webp'
          srcSet={srcSet}
          sizes={large ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 640px) 100vw, 33vw'}
        />
      )}
      <img
        src={finalSrc}
        alt={alt}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => {
          setHasError(true);
          onError?.();
        }}
      />
    </picture>
  );
}
