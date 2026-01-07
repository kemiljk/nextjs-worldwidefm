/**
 * Image optimization utilities for Cosmic imgix URLs
 * 
 * Aggressive optimization strategy to minimize bandwidth costs:
 * - Uses imgix auto=format for WebP/AVIF delivery
 * - Aggressive quality settings (60-75 range)
 * - Device pixel ratio capping
 * - Strip metadata to reduce file size
 * - Proper sizing to avoid oversized images
 */

export interface ImageOptimizationOptions {
  width: number;
  height?: number;
  quality?: number;
  fit?: 'crop' | 'clip' | 'fill' | 'scale' | 'max';
  dpr?: number;
  blur?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
}

/**
 * Quality presets for different use cases
 * Lower quality = smaller file size = lower bandwidth costs
 */
export const QUALITY_PRESETS = {
  /** Thumbnails, grid cards - aggressive compression */
  thumbnail: 55,
  /** Standard cards, medium-sized images */
  card: 60,
  /** Featured content, larger displays */
  featured: 70,
  /** Hero images, full-width displays */
  hero: 75,
  /** Gallery images that need detail */
  gallery: 70,
  /** Video thumbnails */
  video: 60,
  /** Low quality placeholder for blur-up effect */
  placeholder: 20,
} as const;

/**
 * Size presets for common use cases (in pixels)
 */
export const SIZE_PRESETS = {
  /** Small thumbnails (80x80) */
  thumbnailSmall: { width: 80, height: 80 },
  /** Medium thumbnails (150x150) */
  thumbnailMedium: { width: 150, height: 150 },
  /** Card images on mobile */
  cardMobile: { width: 400, height: 400 },
  /** Card images on tablet */
  cardTablet: { width: 500, height: 500 },
  /** Card images on desktop */
  cardDesktop: { width: 600, height: 600 },
  /** Featured card images */
  featuredCard: { width: 800, height: 800 },
  /** Hero images mobile */
  heroMobile: { width: 768, height: 768 },
  /** Hero images tablet */
  heroTablet: { width: 1024, height: 1024 },
  /** Hero images desktop */
  heroDesktop: { width: 1400, height: 1400 },
  /** Full-width hero */
  heroFullWidth: { width: 1920, height: 1080 },
  /** Video thumbnail 16:9 */
  videoThumbnail: { width: 640, height: 360 },
  /** Video thumbnail large */
  videoThumbnailLarge: { width: 1280, height: 720 },
} as const;

/**
 * Check if a URL is an imgix URL from Cosmic
 */
export function isImgixUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.includes('imgix.cosmicjs.com');
}

/**
 * Check if a URL is a Cosmic CDN URL that can be converted to imgix
 */
export function isCosmicCdnUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.includes('cdn.cosmicjs.com');
}

/**
 * Convert Cosmic CDN URL to imgix URL for optimization
 */
export function convertToImgixUrl(url: string): string {
  if (isImgixUrl(url)) return url;
  if (isCosmicCdnUrl(url)) {
    return url.replace('cdn.cosmicjs.com', 'imgix.cosmicjs.com');
  }
  return url;
}

/**
 * Build an optimized imgix URL with aggressive compression settings
 */
export function buildImgixUrl(
  baseUrl: string,
  options: ImageOptimizationOptions
): string {
  if (!baseUrl) return '/image-placeholder.png';
  
  // Convert to imgix if it's a cosmic CDN URL
  const url = convertToImgixUrl(baseUrl);
  
  // If not an imgix URL, return as-is
  if (!isImgixUrl(url)) return baseUrl;
  
  const {
    width,
    height,
    quality = QUALITY_PRESETS.card,
    fit = 'crop',
    dpr = 1,
    blur,
    format = 'auto',
  } = options;

  const params = new URLSearchParams();
  
  // Dimensions
  params.set('w', String(width));
  if (height) params.set('h', String(height));
  
  // Fit mode
  params.set('fit', fit);
  
  // Auto format detection (WebP/AVIF for supported browsers)
  // auto=format,compress enables best format + compression
  params.set('auto', 'format,compress');
  
  // Quality (aggressive for bandwidth savings)
  params.set('q', String(quality));
  
  // Device pixel ratio - cap at 1.5 to avoid 2x/3x bloat
  // Most users won't notice difference but file size is much larger
  if (dpr > 1) {
    params.set('dpr', String(Math.min(dpr, 1.5)));
  }
  
  // Strip metadata to reduce file size
  params.set('cs', 'strip');
  
  // Blur for placeholder images
  if (blur) {
    params.set('blur', String(blur));
  }
  
  // Ensure progressive loading for JPEGs
  params.set('fm', format === 'auto' ? 'jpg' : format);
  params.set('auto', 'format,compress');
  
  // Build URL
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

/**
 * Generate srcset for responsive images
 * Uses sensible breakpoints to avoid too many sizes
 */
export function generateSrcSet(
  baseUrl: string,
  options: {
    widths: number[];
    quality?: number;
    fit?: 'crop' | 'clip' | 'fill' | 'scale' | 'max';
    aspectRatio?: number; // height/width ratio
  }
): string {
  if (!baseUrl || !isImgixUrl(convertToImgixUrl(baseUrl))) return '';
  
  const { widths, quality = QUALITY_PRESETS.card, fit = 'crop', aspectRatio } = options;
  
  return widths
    .map(w => {
      const height = aspectRatio ? Math.round(w * aspectRatio) : undefined;
      const url = buildImgixUrl(baseUrl, { width: w, height, quality, fit });
      return `${url} ${w}w`;
    })
    .join(', ');
}

/**
 * Predefined srcset configurations for common layouts
 */
export const SRCSET_CONFIGS: Record<string, number[]> = {
  /** For card grids: 400, 600, 800px */
  card: [400, 600, 800],
  /** For thumbnails: 100, 200, 300px */
  thumbnail: [100, 200, 300],
  /** For hero images: 768, 1024, 1400, 1920px */
  hero: [768, 1024, 1400, 1920],
  /** For video thumbnails: 320, 640, 1280px */
  video: [320, 640, 1280],
  /** For featured content: 600, 900, 1200px */
  featured: [600, 900, 1200],
};

/**
 * Get optimized image URL for a thumbnail
 */
export function getThumbnailUrl(
  src: string | undefined,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  if (!src) return '/image-placeholder.png';
  
  const sizes = {
    small: SIZE_PRESETS.thumbnailSmall,
    medium: SIZE_PRESETS.thumbnailMedium,
    large: SIZE_PRESETS.cardMobile,
  };
  
  const { width, height } = sizes[size];
  return buildImgixUrl(src, { 
    width, 
    height, 
    quality: QUALITY_PRESETS.thumbnail,
    fit: 'crop'
  });
}

/**
 * Get optimized image URL for a card
 */
export function getCardImageUrl(
  src: string | undefined,
  variant: 'mobile' | 'tablet' | 'desktop' | 'featured' = 'desktop'
): string {
  if (!src) return '/image-placeholder.png';
  
  const sizes = {
    mobile: SIZE_PRESETS.cardMobile,
    tablet: SIZE_PRESETS.cardTablet,
    desktop: SIZE_PRESETS.cardDesktop,
    featured: SIZE_PRESETS.featuredCard,
  };
  
  const { width, height } = sizes[variant];
  const quality = variant === 'featured' ? QUALITY_PRESETS.featured : QUALITY_PRESETS.card;
  
  return buildImgixUrl(src, { width, height, quality, fit: 'crop' });
}

/**
 * Get optimized image URL for hero images
 */
export function getHeroImageUrl(
  src: string | undefined,
  variant: 'mobile' | 'tablet' | 'desktop' | 'fullWidth' = 'desktop'
): string {
  if (!src) return '/image-placeholder.png';
  
  const sizes = {
    mobile: SIZE_PRESETS.heroMobile,
    tablet: SIZE_PRESETS.heroTablet,
    desktop: SIZE_PRESETS.heroDesktop,
    fullWidth: SIZE_PRESETS.heroFullWidth,
  };
  
  const { width, height } = sizes[variant];
  return buildImgixUrl(src, { 
    width, 
    height, 
    quality: QUALITY_PRESETS.hero,
    fit: 'crop'
  });
}

/**
 * Get optimized image URL for video thumbnails
 */
export function getVideoThumbnailUrl(
  src: string | undefined,
  large: boolean = false
): string {
  if (!src) return '/image-placeholder.png';
  
  const size = large ? SIZE_PRESETS.videoThumbnailLarge : SIZE_PRESETS.videoThumbnail;
  return buildImgixUrl(src, { 
    ...size, 
    quality: QUALITY_PRESETS.card,
    fit: 'crop'
  });
}

/**
 * Get a low-quality placeholder URL for blur-up effect
 */
export function getPlaceholderUrl(src: string | undefined): string {
  if (!src) return '/image-placeholder.png';
  
  return buildImgixUrl(src, {
    width: 20,
    quality: QUALITY_PRESETS.placeholder,
    blur: 50,
    fit: 'crop'
  });
}

/**
 * Extract image URL from Cosmic image object
 * Prefers imgix_url over url for optimization
 */
export function extractImageUrl(
  image: { url?: string; imgix_url?: string } | string | undefined | null
): string {
  if (!image) return '/image-placeholder.png';
  if (typeof image === 'string') return image;
  return image.imgix_url || image.url || '/image-placeholder.png';
}

/**
 * Get the best image source from various possible metadata fields
 */
export function getBestImageSource(metadata: {
  external_image_url?: string;
  image?: { url?: string; imgix_url?: string };
} | undefined): string {
  if (!metadata) return '/image-placeholder.png';
  
  // Check external_image_url first (cold storage for old episodes)
  if (metadata.external_image_url) {
    return metadata.external_image_url;
  }
  
  // Then check image object
  return extractImageUrl(metadata.image);
}
