import { describe, it, expect } from 'bun:test';
import {
  inspectMp3Structure,
  MINIMAL_ID3V2_HEADER,
  prependMinimalId3Tag,
} from '@/lib/mp3-utils';

const TAGLESS_MP3 = Buffer.from([
  0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const TAGGED_MP3 = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00,
]);

const FF_DOMINANT_AFTER_ID3 = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00,
]);

const ZERO_DOMINANT = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff,
]);

describe('inspectMp3Structure', () => {
  it('detects tagless MP3 (starts with FF FB)', () => {
    const result = inspectMp3Structure(TAGLESS_MP3);
    expect(result.hasId3Header).toBe(false);
    expect(result.hasMpegFrameSync).toBe(true);
    expect(result.firstBytes).toBe('FFFBE04000000000');
    expect(result.id3Version).toBeUndefined();
    expect(result.fileSize).toBe(TAGLESS_MP3.length);
  });

  it('detects tagged MP3 (starts with ID3)', () => {
    const result = inspectMp3Structure(TAGGED_MP3);
    expect(result.hasId3Header).toBe(true);
    expect(result.hasMpegFrameSync).toBe(true);
    expect(result.firstBytes).toBe('4944330300000000');
    expect(result.id3Version).toBe('ID3v2.3');
    expect(result.fileSize).toBe(TAGGED_MP3.length);
  });

  it('reports FF-dominant padding pattern', () => {
    const result = inspectMp3Structure(FF_DOMINANT_AFTER_ID3);
    expect(result.paddingPattern).toBe('FF-dominant');
  });

  it('reports 00-dominant padding pattern', () => {
    const result = inspectMp3Structure(ZERO_DOMINANT);
    expect(result.paddingPattern).toBe('00-dominant');
  });

  it('handles empty buffer gracefully', () => {
    const result = inspectMp3Structure(Buffer.alloc(0));
    expect(result.hasId3Header).toBe(false);
    expect(result.hasMpegFrameSync).toBe(false);
    expect(result.firstBytes).toBe('');
    expect(result.fileSize).toBe(0);
  });

  it('handles too-small buffer (1 byte) gracefully', () => {
    const small = Buffer.from([0xff]);
    const result = inspectMp3Structure(small);
    expect(result.hasId3Header).toBe(false);
    expect(result.hasMpegFrameSync).toBe(false);
    expect(result.firstBytes).toBe('FF');
  });

  it('reports mixed padding when neither FF nor 00 dominates', () => {
    const mixed = Buffer.from([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0xff, 0x00,
    ]);
    const result = inspectMp3Structure(mixed);
    expect(result.paddingPattern).toBe('mixed');
  });
});

describe('prependMinimalId3Tag', () => {
  it('output starts with ID3 header bytes', () => {
    const patched = prependMinimalId3Tag(TAGLESS_MP3);
    expect(patched.slice(0, 3).toString('ascii')).toBe('ID3');
    expect(patched.slice(0, 10)).toEqual(MINIMAL_ID3V2_HEADER);
  });

  it('original MPEG data follows immediately after the 10-byte header', () => {
    const patched = prependMinimalId3Tag(TAGLESS_MP3);
    expect(patched.slice(10)).toEqual(TAGLESS_MP3);
  });

  it('total size equals original size + 10', () => {
    const patched = prependMinimalId3Tag(TAGLESS_MP3);
    expect(patched.length).toBe(TAGLESS_MP3.length + 10);
  });

  it('inspectMp3Structure on patched buffer returns hasId3Header true', () => {
    const patched = prependMinimalId3Tag(TAGLESS_MP3);
    const result = inspectMp3Structure(patched);
    expect(result.hasId3Header).toBe(true);
    expect(result.id3Version).toBe('ID3v2.3');
  });
});
