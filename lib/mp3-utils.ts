/**
 * Inspect MP3 file structure for diagnostics.
 * Returns info about ID3 header, MPEG frame sync, and padding patterns.
 */
export function inspectMp3Structure(buffer: Buffer): {
  hasId3Header: boolean;
  hasMpegFrameSync: boolean;
  firstBytes: string;
  id3Version?: string;
  paddingPattern?: string;
  fileSize: number;
} {
  const hasId3Header = buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3';

  let syncOffset = 0;
  if (hasId3Header && buffer.length >= 10) {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    syncOffset = 10 + size;
  }

  const hasMpegFrameSync =
    buffer.length > syncOffset + 1 &&
    (buffer[syncOffset] === 0xff || buffer[syncOffset] === 0xfe) &&
    (buffer[syncOffset + 1] & 0xe0) === 0xe0;

  const firstBytes = buffer.slice(0, Math.min(8, buffer.length)).toString('hex').toUpperCase();

  let id3Version: string | undefined;
  if (hasId3Header && buffer.length >= 4) {
    const major = buffer[3];
    id3Version = `ID3v2.${major}`;
  }

  let paddingPattern: string | undefined;
  if (buffer.length >= 16) {
    const paddingStart = hasId3Header ? 10 : 0;
    const ffCount = buffer.slice(paddingStart, paddingStart + 8).filter(b => b === 0xff).length;
    const zeroCount = buffer.slice(paddingStart, paddingStart + 8).filter(b => b === 0x00).length;
    if (ffCount > 4) paddingPattern = 'FF-dominant';
    else if (zeroCount > 4) paddingPattern = '00-dominant';
    else paddingPattern = 'mixed';
  }

  return {
    hasId3Header,
    hasMpegFrameSync,
    firstBytes,
    id3Version,
    paddingPattern,
    fileSize: buffer.length,
  };
}

/**
 * Minimal ID3v2.3.0 header (10 bytes, size 0).
 * Prepend to tagless MP3s so RadioCult accepts them.
 */
export const MINIMAL_ID3V2_HEADER = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

export function prependMinimalId3Tag(buffer: Buffer): Buffer {
  return Buffer.concat([MINIMAL_ID3V2_HEADER, buffer]);
}
