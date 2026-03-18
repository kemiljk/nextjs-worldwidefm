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
