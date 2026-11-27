import { describe, expect, test } from 'bun:test';
import { getLiveStatus, isPlaylistTitle } from '../lib/live-status';

describe('getLiveStatus', () => {
  test('a scheduled show is on air', () => {
    expect(getLiveStatus({ scheduleShowName: 'Gilles Peterson' })).toEqual({
      isOnAir: true,
      isPlaylist: false,
    });
  });

  test('a schedule show wins over a playlist title from the stream', () => {
    expect(
      getLiveStatus({ scheduleShowName: 'Morning Mari', streamTitle: 'WWFM Playlist' }).isOnAir
    ).toBe(true);
  });

  test('a real show reported by the stream is on air', () => {
    expect(getLiveStatus({ streamTitle: 'Sam Bhok' })).toEqual({
      isOnAir: true,
      isPlaylist: false,
    });
  });

  test('the playlist is not live radio', () => {
    expect(getLiveStatus({ streamTitle: 'WWFM Playlist' })).toEqual({
      isOnAir: false,
      isPlaylist: true,
    });
    expect(getLiveStatus({ streamTitle: 'WWFM' }).isOnAir).toBe(false);
  });

  test('no information means no live indicator', () => {
    expect(getLiveStatus({})).toEqual({ isOnAir: false, isPlaylist: false });
    expect(getLiveStatus({ scheduleShowName: null, streamTitle: '' }).isOnAir).toBe(false);
  });

  test('a WWFM-branded show is not mistaken for the playlist', () => {
    expect(isPlaylistTitle('WWFM Show with Someone')).toBe(false);
  });
});
