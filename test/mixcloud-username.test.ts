import { describe, expect, it } from 'bun:test';
import { mixcloudHostUsernames, normalizeMixcloudUsername } from '@/lib/mixcloud-username';

describe('normalizeMixcloudUsername', () => {
  it.each([
    ['rohan-rakhit', 'rohan-rakhit'],
    ['  @zaereo ', 'zaereo'],
    ['https://www.mixcloud.com/_donut_dj/', '_donut_dj'],
    ['mixcloud.com/GillesPeterson/uploads/', 'GillesPeterson'],
    ['http://m.mixcloud.com/Some_One?ref=x', 'Some_One'],
    ['Gilles Peterson', ''],
    ['https://example.com/someone', ''],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeMixcloudUsername(input)).toBe(expected);
  });

  it('rejects non-strings', () => {
    expect(normalizeMixcloudUsername(undefined)).toBe('');
    expect(normalizeMixcloudUsername(42)).toBe('');
  });
});

describe('mixcloudHostUsernames', () => {
  it('drops invalid and duplicate values and keeps Mixcloud’s two-host limit', () => {
    expect(
      mixcloudHostUsernames([
        '@one',
        'ONE',
        'not valid',
        null,
        'https://mixcloud.com/two/',
        'three',
      ])
    ).toEqual(['one', 'two']);
  });
});
