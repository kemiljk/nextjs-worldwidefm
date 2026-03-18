import { describe, it, expect } from 'bun:test';
import { buildRawMediaFilename } from '@/lib/upload-filename-utils';

describe('buildRawMediaFilename', () => {
  it('produces rawYYYYMMDD Title.ext format without brackets', () => {
    const result = buildRawMediaFilename('2025-03-12', 'Morning Show', 'episode.mp3');
    expect(result).toBe('raw20250312 Morning Show.mp3');
  });

  it('handles special characters in title by sanitizing', () => {
    const result = buildRawMediaFilename('2025-03-12', 'Show: "Quote" [Brackets]', 'audio.mp3');
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
    expect(result).not.toContain(':');
    expect(result).not.toContain('"');
  });

  it('falls back to .mp3 when no extension in original filename', () => {
    const result = buildRawMediaFilename('2025-03-12', 'No Ext', 'plainfile');
    expect(result).toMatch(/\.mp3$/);
    expect(result).toBe('raw20250312 No Ext.mp3');
  });

  it('falls back to Untitled Show when title is empty', () => {
    const result = buildRawMediaFilename('2025-03-12', '', 'audio.wav');
    expect(result).toBe('raw20250312 Untitled Show.wav');
  });

  it('falls back to Untitled Show when title is whitespace-only', () => {
    const result = buildRawMediaFilename('2025-03-12', '   ', 'audio.mp3');
    expect(result).toBe('raw20250312 Untitled Show.mp3');
  });

  it('preserves non-mp3 extensions from original filename', () => {
    const result = buildRawMediaFilename('2025-03-12', 'WAV Show', 'recording.wav');
    expect(result).toBe('raw20250312 WAV Show.wav');
  });

  it('uses first 8 chars of date when date includes time', () => {
    const result = buildRawMediaFilename('2025-03-12T14:30:00', 'Test', 'x.mp3');
    expect(result).toBe('raw20250312 Test.mp3');
  });
});
