import { describe, expect, it } from 'bun:test';
import {
  extractSubmittedMixcloudUsernames,
  mixcloudHostUsernames,
  normalizeMixcloudUsername,
} from '@/lib/mixcloud-username';

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

describe('extractSubmittedMixcloudUsernames', () => {
  it('reads @handles and mixcloud links, and ignores plain names and emails', () => {
    expect(
      extractSubmittedMixcloudUsernames(
        'Me: Jo Bloggs @jo_bloggs, co-host https://www.mixcloud.com/Sam-S/ (sam@example.com)'
      )
    ).toEqual([
      { username: 'jo_bloggs', fromLink: false },
      { username: 'Sam-S', fromLink: true },
    ]);
  });

  it('lists each username once and marks it as a link if any mention was a link', () => {
    expect(
      extractSubmittedMixcloudUsernames('@Rohan and mixcloud.com/rohan/uploads, also @rohan.')
    ).toEqual([{ username: 'Rohan', fromLink: true }]);
  });

  it('returns nothing for text without usernames', () => {
    expect(extractSubmittedMixcloudUsernames('Gilles Peterson and friend')).toEqual([]);
    expect(extractSubmittedMixcloudUsernames(undefined)).toEqual([]);
  });
});
