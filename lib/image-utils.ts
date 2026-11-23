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
  thumbnail: 55,
  card: 60,
  featured: 70,
  hero: 75,
  gallery: 70,
  video: 60,
  placeholder: 20,
} as const;

/**
 * Size presets for common use cases (in pixels)
 */
export const SIZE_PRESETS = {
  thumbnailSmall: { width: 80, height: 80 },
  thumbnailMedium: { width: 150, height: 150 },
  cardMobile: { width: 400, height: 400 },
  cardTablet: { width: 500, height: 500 },
  cardDesktop: { width: 600, height: 600 },
  featuredCard: { width: 800, height: 800 },
  heroMobile: { width: 768, height: 768 },
  heroTablet: { width: 1024, height: 1024 },
  heroDesktop: { width: 1400, height: 1400 },
  heroFullWidth: { width: 1920, height: 1080 },
  videoThumbnail: { width: 640, height: 360 },
  videoThumbnailLarge: { width: 1280, height: 720 },
} as const;

export function isImgixUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.includes('imgix.cosmicjs.com');
}

export function isCosmicCdnUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.includes('cdn.cosmicjs.com');
}

export function convertToImgixUrl(url: string): string {
  if (isImgixUrl(url)) return url;
  if (isCosmicCdnUrl(url)) {
    return url.replace('cdn.cosmicjs.com', 'imgix.cosmicjs.com');
  }
  return url;
}

export function buildImgixUrl(baseUrl: string, options: ImageOptimizationOptions): string {
  if (!baseUrl) return '/image-placeholder.png';

  const url = convertToImgixUrl(baseUrl);

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

  params.set('w', String(width));
  if (height) params.set('h', String(height));

  params.set('fit', fit);

  params.set('auto', 'format,compress');

  params.set('q', String(quality));

  // Device pixel ratio - cap at 1.5 to avoid 2x/3x bloat
  // Most users won't notice difference but file size is much larger
  if (dpr > 1) {
    params.set('dpr', String(Math.min(dpr, 1.5)));
  }

  params.set('cs', 'strip');

  if (blur) {
    params.set('blur', String(blur));
  }

  params.set('fm', format === 'auto' ? 'jpg' : format);
  params.set('auto', 'format,compress');

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

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

export const SRCSET_CONFIGS: Record<string, number[]> = {
  card: [400, 600, 800],
  thumbnail: [100, 200, 300],
  hero: [480, 768, 1024, 1200, 1400, 1920],
  video: [320, 640, 1280],
  featured: [600, 900, 1200],
};

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
    fit: 'crop',
  });
}

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
    fit: 'crop',
  });
}

export function getVideoThumbnailUrl(src: string | undefined, large: boolean = false): string {
  if (!src) return '/image-placeholder.png';

  const size = large ? SIZE_PRESETS.videoThumbnailLarge : SIZE_PRESETS.videoThumbnail;
  return buildImgixUrl(src, {
    ...size,
    quality: QUALITY_PRESETS.card,
    fit: 'crop',
  });
}

export function getPlaceholderUrl(src: string | undefined): string {
  if (!src) return '/image-placeholder.png';

  return buildImgixUrl(src, {
    width: 20,
    quality: QUALITY_PRESETS.placeholder,
    blur: 50,
    fit: 'crop',
  });
}

export function extractImageUrl(
  image: { url?: string; imgix_url?: string } | string | undefined | null
): string {
  if (!image) return '/image-placeholder.png';
  if (typeof image === 'string') return image;
  return image.imgix_url || image.url || '/image-placeholder.png';
}

export function getBestImageSource(
  metadata:
    | {
        external_image_url?: string;
        image?: { url?: string; imgix_url?: string };
      }
    | undefined
): string {
  if (!metadata) return '/image-placeholder.png';

  // Check external_image_url first (cold storage for old episodes)
  if (metadata.external_image_url) {
    return metadata.external_image_url;
  }

  return extractImageUrl(metadata.image);
}
