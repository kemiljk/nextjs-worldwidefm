import { PostObject } from './cosmic-config';

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

// Helper to add imgix optimization params
const optimizeImgix = (url: string | undefined, size: number = 600): string | undefined => {
  if (!url) return undefined;
  // Only add params to imgix URLs (not YouTube/Vimeo thumbnails)
  if (url.includes('imgix.cosmicjs.com')) {
    return `${url}?w=${size}&h=${size}&fit=crop&auto=format,compress`;
  }
  return url;
};

export function getPostThumbnail(post: PostObject): string {
  const metadata = post.metadata;
  
  if (!metadata) {
    return optimizeImgix(post.thumbnail?.imgix_url, 600) || '/image-placeholder.png';
  }

  // Check for video_url first (new field), then fall back to youtube_video
  const videoUrl = (metadata as any).video_url || metadata.youtube_video;
  const directVideo = metadata.video;
  
  if (videoUrl) {
    const customThumbnail = metadata.youtube_video_thumbnail?.imgix_url || metadata.video_thumbnail?.imgix_url;
    if (customThumbnail) {
      return optimizeImgix(customThumbnail, 600) || customThumbnail;
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
      return optimizeImgix(customThumbnail, 600) || customThumbnail;
    }
    if (typeof directVideo === 'object' && directVideo.imgix_url) {
      return optimizeImgix(directVideo.imgix_url, 600) || directVideo.imgix_url;
    }
  }
  
  return (
    optimizeImgix(post.thumbnail?.imgix_url, 600) ||
    optimizeImgix(metadata.image?.imgix_url, 600) ||
    '/image-placeholder.png'
  );
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

export function getPostVideoThumbnail(post: PostObject): string | null {
  const metadata = post.metadata;
  if (!metadata) return null;
  
  // Check for video_url first (new field), then fall back to youtube_video
  const videoUrl = (metadata as any).video_url || metadata.youtube_video;
  const directVideo = metadata.video;
  
  if (videoUrl) {
    const customThumbnail = metadata.youtube_video_thumbnail?.imgix_url || metadata.video_thumbnail?.imgix_url;
    if (customThumbnail) {
      return optimizeImgix(customThumbnail, 1200) || customThumbnail;
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
      return optimizeImgix(customThumbnail, 1200) || customThumbnail;
    }
    if (typeof directVideo === 'object' && directVideo.imgix_url) {
      return optimizeImgix(directVideo.imgix_url, 1200) || directVideo.imgix_url;
    }
  }
  
  return null;
}

