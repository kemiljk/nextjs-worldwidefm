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

export interface SubmittedMixcloudUsername {
  username: string;
  /** Pasted as a mixcloud.com link, so it is certainly a Mixcloud account. A bare @name could be any platform. */
  fromLink: boolean;
}

const SUBMITTED_USERNAME_PATTERN =
  /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?mixcloud\.com\/([A-Za-z0-9_-]+)|(?<![\w@./-])@([A-Za-z0-9_-]{1,50})/gi;

/**
 * Hosts type usernames into the submission form's free-text box. Picks out the ones written as
 * `@name` or a mixcloud.com link (a plain name can't be told apart from a person's name).
 */
export function extractSubmittedMixcloudUsernames(text: unknown): SubmittedMixcloudUsername[] {
  if (typeof text !== 'string') return [];
  const found = new Map<string, SubmittedMixcloudUsername>();
  for (const match of text.matchAll(SUBMITTED_USERNAME_PATTERN)) {
    const username = normalizeMixcloudUsername(match[1] ?? match[2]);
    if (!username) continue;
    const key = username.toLowerCase();
    const fromLink = match[1] !== undefined;
    const existing = found.get(key);
    if (!existing) found.set(key, { username, fromLink });
    else if (fromLink) existing.fromLink = true;
  }
  return [...found.values()];
}
