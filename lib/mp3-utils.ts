/**
 * Inspect MP3 file structure for diagnostics.
 * Returns info about ID3 header, MPEG frame sync, and padding patterns.
 *
 * Only the leading bytes are read, so callers holding a large file may pass a
 * head slice plus the real `totalSize` instead of the whole thing.
 */
export function inspectMp3Structure(
  buffer: Buffer,
  totalSize: number = buffer.length
): {
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
    fileSize: totalSize,
  };
}

export const ID3V2_HEADER_LENGTH = 10;

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

/**
 * Byte length of the leading ID3v2 tag, or 0 when there is none.
 *
 * `head` only needs to contain the first 10 bytes; pass `totalSize` when it is
 * a slice of a larger file so the result stays clamped to the real length.
 */
export function readId3v2TagLength(head: Buffer, totalSize: number = head.length): number {
  if (head.length < ID3V2_HEADER_LENGTH || head.toString('ascii', 0, 3) !== 'ID3') {
    return 0;
  }

  const size =
    ((head[6] & 0x7f) << 21) |
    ((head[7] & 0x7f) << 14) |
    ((head[8] & 0x7f) << 7) |
    (head[9] & 0x7f);

  return Math.min(ID3V2_HEADER_LENGTH + size, totalSize);
}

function encodeSyncSafeSize(size: number): Buffer {
  return Buffer.from([(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]);
}

function createId3v23TextFrame(frameId: 'TIT2' | 'TPE1', value: string): Buffer {
  const text = value.trim();
  const utf16Text = Buffer.from(text, 'utf16le');
  const payload = Buffer.concat([Buffer.from([0x01, 0xff, 0xfe]), utf16Text]);
  const header = Buffer.alloc(10);

  header.write(frameId, 0, 4, 'ascii');
  header.writeUInt32BE(payload.length, 4);

  return Buffer.concat([header, payload]);
}

/**
 * Build a standalone ID3v2.3 tag, or null when there is nothing to write.
 *
 * Returned separately from the audio so large files can be reassembled as a
 * `Blob` view rather than a full in-memory concat.
 */
export function buildId3v23Tag(metadata: { title?: string; artist?: string }): Buffer | null {
  const frames = [
    metadata.title?.trim() ? createId3v23TextFrame('TIT2', metadata.title) : undefined,
    metadata.artist?.trim() ? createId3v23TextFrame('TPE1', metadata.artist) : undefined,
  ].filter((frame): frame is Buffer => !!frame);

  if (frames.length === 0) {
    return null;
  }

  const payload = Buffer.concat(frames);
  const header = Buffer.concat([
    Buffer.from('ID3', 'ascii'),
    Buffer.from([0x03, 0x00, 0x00]),
    encodeSyncSafeSize(payload.length),
  ]);

  return Buffer.concat([header, payload]);
}

export function writeMp3Id3v23Metadata(
  buffer: Buffer,
  metadata: { title?: string; artist?: string }
): Buffer {
  const tag = buildId3v23Tag(metadata);
  if (!tag) {
    return buffer;
  }

  return Buffer.concat([tag, buffer.subarray(readId3v2TagLength(buffer))]);
}
