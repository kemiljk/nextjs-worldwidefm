/** Reads an Instagram handle or profile URL from a Cosmic field and returns the canonical profile. */
export function instagramProfile(value: unknown): { url: string; handle: string } | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  let handle = input.replace(/^@/, '');
  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return null;
      handle = url.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;
  return { url: `https://www.instagram.com/${handle}/`, handle };
}
