import { instagramProfile } from './instagram';

export interface LinkableHost {
  title?: string | null;
  // Cosmic host metadata varies by query; only `instagram` is read.
  metadata?: object | null;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Wraps each mention of a host's name in show copy with a link to their Instagram.
 * Only hosts with a valid Instagram handle are linked, text already inside a link
 * is left alone, and only text (never tags or attributes) is rewritten. Run the
 * result through the HTML sanitiser as usual.
 */
export function linkHostNames(html: string, hosts: LinkableHost[] | null | undefined): string {
  if (!html || !hosts?.length) return html;

  const targets = hosts
    .map(host => ({
      name: host.title?.trim() || '',
      profile: instagramProfile(
        (host.metadata as { instagram?: unknown } | null | undefined)?.instagram
      ),
    }))
    .filter((target): target is { name: string; profile: { url: string; handle: string } } =>
      Boolean(target.name && target.profile)
    )
    .sort((a, b) => b.name.length - a.name.length);
  if (targets.length === 0) return html;

  const urlByName = new Map(targets.map(({ name, profile }) => [name.toLowerCase(), profile.url]));
  const alternatives = targets.flatMap(({ name }) => [escapeHtml(name), name]);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${[...new Set(alternatives)].map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
    'giu'
  );

  let linkDepth = 0;
  let skipDepth = 0;
  return html
    .split(/(<[^>]*>)/)
    .map(part => {
      if (part.startsWith('<')) {
        const tag = /^<\s*(\/?)\s*([a-zA-Z0-9]+)/.exec(part);
        if (tag) {
          const [, closing, name] = tag;
          const lower = name.toLowerCase();
          if (lower === 'a') linkDepth = Math.max(0, linkDepth + (closing ? -1 : 1));
          if (lower === 'script' || lower === 'style')
            skipDepth = Math.max(0, skipDepth + (closing ? -1 : 1));
        }
        return part;
      }
      if (linkDepth > 0 || skipDepth > 0) return part;
      return part.replace(pattern, match => {
        const decoded = match.replace(/&amp;/g, '&').toLowerCase();
        const url = urlByName.get(decoded);
        return url
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${match}</a>`
          : match;
      });
    })
    .join('');
}
