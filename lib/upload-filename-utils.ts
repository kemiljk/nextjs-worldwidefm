const sanitizeFilenameSegment = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[\[\]]/g, '')
    .replace(/[\\/:"*?<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getFileExtension = (filename: string) => {
  const extensionStart = filename.lastIndexOf('.');
  return extensionStart > 0 ? filename.slice(extensionStart).toLowerCase() : '';
};

export function buildMediaMetadataTitle(filename: string): string {
  const trimmed = filename.trim();
  const extensionStart = trimmed.lastIndexOf('.');

  return extensionStart > 0 ? trimmed.slice(0, extensionStart) : trimmed;
}

export function buildTemporaryMediaBlobPath(filename: string): string {
  const safeFilename = filename
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `media/${Date.now()}-${safeFilename || 'audio.mp3'}`;
}

export function buildRawMediaFilename(
  broadcastDate: string,
  title: string,
  originalFilename: string
): string {
  const datePart = broadcastDate.replace(/-/g, '').slice(0, 8);
  const safeTitle = sanitizeFilenameSegment(title) || 'Untitled Show';
  const extension = getFileExtension(originalFilename) || '.mp3';

  return `raw${datePart} ${safeTitle}${extension}`;
}

export function buildShowImageFilename(
  broadcastDate: string,
  title: string,
  originalFilename: string
): string {
  const datePart = broadcastDate.replace(/-/g, '').slice(0, 8);
  const safeTitle = sanitizeFilenameSegment(title) || 'Untitled Show';
  const extension = getFileExtension(originalFilename) || '.jpg';

  return `${datePart} ${safeTitle}${extension}`;
}

export function buildHostImageFilename(hostName: string, originalFilename: string): string {
  const safeName = sanitizeFilenameSegment(hostName) || 'Host';
  const extension = getFileExtension(originalFilename) || '.jpg';

  return `${safeName}${extension}`;
}
