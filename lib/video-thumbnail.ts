type VideoThumbnailSource = {
  external_image_url?: string | null;
  image?: { imgix_url?: string | null; url?: string | null } | null;
  video_url?: string | null;
};

export function getYouTubeThumbnailUrl(url: string): string {
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11
    ? `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`
    : '';
}

export function getVimeoThumbnailUrl(url: string): string {
  const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/);
  return match ? `https://vumbnail.com/${match[1]}.jpg` : '';
}

/** Editor-uploaded image first, then the provider's own thumbnail. Empty if neither exists. */
export function getVideoThumbnailUrl(metadata: VideoThumbnailSource | null | undefined): string {
  if (!metadata) return '';

  const videoUrl = metadata.video_url || '';
  return (
    metadata.external_image_url ||
    metadata.image?.imgix_url ||
    metadata.image?.url ||
    (videoUrl ? getYouTubeThumbnailUrl(videoUrl) || getVimeoThumbnailUrl(videoUrl) : '')
  );
}
