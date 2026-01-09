import { PostObject } from './cosmic-config';
import { buildImgixUrl, QUALITY_PRESETS, isImgixUrl, convertToImgixUrl } from './image-utils';

function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function getVimeoId(url: string): string | null {
  const regExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function getYouTubeThumbnail(url: string): string {
  const videoId = getYouTubeId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return '';
}

function getVimeoThumbnail(url: string): string {
  const videoId = getVimeoId(url);
  if (videoId) {
    return `https://vumbnail.com/${videoId}.jpg`;
  }
  return '';
}

function optimizeImageUrl(url: string | undefined, width: number = 600): string {
  if (!url) return '/image-placeholder.png';

  const normalizedUrl = convertToImgixUrl(url);
  if (isImgixUrl(normalizedUrl)) {
    return buildImgixUrl(url, { width, quality: QUALITY_PRESETS.card });
  }
  return url;
}

export function getPostThumbnail(post: PostObject, width: number = 600): string {
  const metadata = post.metadata;

  if (!metadata) {
    return optimizeImageUrl(post.thumbnail?.imgix_url, width);
  }

  // Check for video_url first (new field), then fall back to youtube_video
  const videoUrl = (metadata as any).video_url || metadata.youtube_video;
  const directVideo = metadata.video;

  if (videoUrl) {
    const customThumbnail =
      metadata.youtube_video_thumbnail?.imgix_url || metadata.video_thumbnail?.imgix_url;
    if (customThumbnail) {
      return optimizeImageUrl(customThumbnail, width);
    }
    const youtubeThumbnail = getYouTubeThumbnail(videoUrl);
    if (youtubeThumbnail) {
      return youtubeThumbnail;
    }
    const vimeoThumbnail = getVimeoThumbnail(videoUrl);
    if (vimeoThumbnail) {
      return vimeoThumbnail;
    }
  }

  if (directVideo) {
    const customThumbnail = metadata.video_thumbnail?.imgix_url;
    if (customThumbnail) {
      return optimizeImageUrl(customThumbnail, width);
    }
    if (typeof directVideo === 'object' && directVideo.imgix_url) {
      return optimizeImageUrl(directVideo.imgix_url, width);
    }
  }

  // External image URLs are already optimized or external
  if ((metadata as any).external_image_url) {
    return (metadata as any).external_image_url;
  }

  return optimizeImageUrl(post.thumbnail?.imgix_url || metadata.image?.imgix_url, width);
}

export function getPostVideoUrl(post: PostObject): string | null {
  const metadata = post.metadata;
  if (!metadata) return null;

  // Check for video_url first (new field), then fall back to youtube_video
  const videoUrl = (metadata as any).video_url || metadata.youtube_video;
  if (videoUrl) {
    return videoUrl;
  }

  if (metadata.video) {
    if (typeof metadata.video === 'object') {
      return metadata.video.url || metadata.video.imgix_url || null;
    }
    if (typeof metadata.video === 'string') {
      return metadata.video;
    }
  }

  return null;
}

export function getPostVideoThumbnail(post: PostObject, width: number = 1280): string | null {
  const metadata = post.metadata;
  if (!metadata) return null;

  // Check for video_url first (new field), then fall back to youtube_video
  const videoUrl = (metadata as any).video_url || metadata.youtube_video;
  const directVideo = metadata.video;

  if (videoUrl) {
    const customThumbnail =
      metadata.youtube_video_thumbnail?.imgix_url || metadata.video_thumbnail?.imgix_url;
    if (customThumbnail) {
      return optimizeImageUrl(customThumbnail, width);
    }
    const youtubeThumbnail = getYouTubeThumbnail(videoUrl);
    if (youtubeThumbnail) {
      return youtubeThumbnail;
    }
    const vimeoThumbnail = getVimeoThumbnail(videoUrl);
    if (vimeoThumbnail) {
      return vimeoThumbnail;
    }
  }

  if (directVideo) {
    const customThumbnail = metadata.video_thumbnail?.imgix_url;
    if (customThumbnail) {
      return optimizeImageUrl(customThumbnail, width);
    }
    if (typeof directVideo === 'object' && directVideo.imgix_url) {
      return optimizeImageUrl(directVideo.imgix_url, width);
    }
  }

  return null;
}
