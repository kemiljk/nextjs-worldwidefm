import { createHash, randomBytes } from 'node:crypto';

export const MEMBER_SESSION_COOKIE = 'wwfm_session';
// Browsers may cap persistent cookies at 400 days. Active members renew this
// window on visits, while abandoned sessions eventually expire.
export const MEMBER_SESSION_LIFETIME_SECONDS = 400 * 24 * 60 * 60;
export const MEMBER_SESSION_RENEW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;

export function createMemberSessionToken(userId: string): string {
  return `${userId}.${randomBytes(32).toString('base64url')}`;
}

export function parseMemberSessionToken(token: string | undefined): { userId: string } | null {
  const match = token?.match(/^([a-zA-Z0-9_-]{1,128})\.([a-zA-Z0-9_-]{43})$/);
  return match ? { userId: match[1] } : null;
}

// Only a digest is stored in Cosmic. Binding it to the password hash also
// invalidates all existing sessions immediately after a password reset.
export function memberSessionDigest(token: string, passwordHash: string): string {
  return createHash('sha256').update(token).update('\0').update(passwordHash).digest('hex');
}

export function sessionExpiry(now = Date.now()): string {
  return new Date(now + MEMBER_SESSION_LIFETIME_SECONDS * 1000).toISOString();
}

export function sessionIsValid(expiry: unknown, now = Date.now()): boolean {
  return (
    typeof expiry === 'string' && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > now
  );
}

// Reset and verification codes are emailed in full and stored only as a digest.
export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
