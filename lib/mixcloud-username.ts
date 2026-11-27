/**
 * Mixcloud usernames are typed into Cosmic by hand, so they arrive as "@name",
 * "name", or a pasted profile link. Mixcloud only tags a host from the bare
 * username, and a wrong value fails silently, so normalise before using one.
 */
export function normalizeMixcloudUsername(value: unknown): string {
  if (typeof value !== 'string') return '';
  let input = value.trim();
  if (!input) return '';

  // Profile links, with or without the scheme: mixcloud.com/name/, www.mixcloud.com/name
  const link = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?mixcloud\.com\/([^/?#\s]+)/i.exec(input);
  if (link) input = link[1];

  try {
    input = decodeURIComponent(input);
  } catch {
    // Keep the text as typed.
  }
  input = input.replace(/^@+/, '').trim();

  // Mixcloud usernames are letters, numbers, underscores and hyphens.
  return /^[A-Za-z0-9_-]{1,50}$/.test(input) ? input : '';
}

export const MAX_MIXCLOUD_HOST_TAGS = 2;

/** Usernames Mixcloud can tag, in order, without duplicates, capped at its two-host limit. */
export function mixcloudHostUsernames(values: unknown[]): string[] {
  const seen = new Set<string>();
  const usernames: string[] = [];
  for (const value of values) {
    const username = normalizeMixcloudUsername(value);
    const key = username.toLowerCase();
    if (!username || seen.has(key)) continue;
    seen.add(key);
    usernames.push(username);
  }
  return usernames.slice(0, MAX_MIXCLOUD_HOST_TAGS);
}
