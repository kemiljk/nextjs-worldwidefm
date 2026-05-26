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

function getId3v2TagLength(buffer: Buffer): number {
  if (buffer.length < 10 || buffer.toString('ascii', 0, 3) !== 'ID3') {
    return 0;
  }

  const size =
    ((buffer[6] & 0x7f) << 21) |
    ((buffer[7] & 0x7f) << 14) |
    ((buffer[8] & 0x7f) << 7) |
    (buffer[9] & 0x7f);

  return Math.min(10 + size, buffer.length);
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

export function writeMp3Id3v23Metadata(
  buffer: Buffer,
  metadata: { title?: string; artist?: string }
): Buffer {
  const frames = [
    metadata.title?.trim() ? createId3v23TextFrame('TIT2', metadata.title) : undefined,
    metadata.artist?.trim() ? createId3v23TextFrame('TPE1', metadata.artist) : undefined,
  ].filter((frame): frame is Buffer => !!frame);

  if (frames.length === 0) {
    return buffer;
  }

  const payload = Buffer.concat(frames);
  const header = Buffer.concat([
    Buffer.from('ID3', 'ascii'),
    Buffer.from([0x03, 0x00, 0x00]),
    encodeSyncSafeSize(payload.length),
  ]);
  const audioData = buffer.subarray(getId3v2TagLength(buffer));

  return Buffer.concat([header, payload, audioData]);
}
