import { afterEach, describe, expect, it } from 'bun:test';
import { getCosmicReadKey } from '@/lib/cosmic-server-env';

const originalPrivateKey = process.env.COSMIC_READ_KEY;
const originalLegacyKey = process.env.NEXT_PUBLIC_COSMIC_READ_KEY;

afterEach(() => {
  if (originalPrivateKey === undefined) delete process.env.COSMIC_READ_KEY;
  else process.env.COSMIC_READ_KEY = originalPrivateKey;
  if (originalLegacyKey === undefined) delete process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
  else process.env.NEXT_PUBLIC_COSMIC_READ_KEY = originalLegacyKey;
});

describe('Cosmic read key', () => {
  it('prefers the server-only name and falls back to the legacy name', () => {
    process.env.COSMIC_READ_KEY = 'private-key';
    process.env.NEXT_PUBLIC_COSMIC_READ_KEY = 'legacy-key';
    expect(getCosmicReadKey()).toBe('private-key');
    delete process.env.COSMIC_READ_KEY;
    expect(getCosmicReadKey()).toBe('legacy-key');
  });
});
