/**
 * Turns the small subset of HTML that Cosmic's rich-text editor produces into a
 * plain tree that React can render as elements. Nothing is injected as HTML, so
 * it is safe in both server and client components: only the tags below survive,
 * and only http(s), mailto and tel links.
 */
export type RichTextTag = 'p' | 'br' | 'strong' | 'em' | 'u' | 'a' | 'ul' | 'ol' | 'li';

export type RichTextNode =
  | { type: 'text'; text: string }
  | { type: 'element'; tag: RichTextTag; href?: string; children: RichTextNode[] };

const TAG_ALIASES: Record<string, RichTextTag> = {
  p: 'p',
  br: 'br',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  u: 'u',
  a: 'a',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
};

const VOID_TAGS = new Set(['br', 'hr', 'img']);
// Their contents are code or styling, never copy, so they are dropped entirely.
const DROP_CONTENT = new Set(['script', 'style', 'iframe', 'noscript', 'template']);
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i;
const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<!--[\s\S]*?-->/g;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function readHref(attributes: string): string | undefined {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attributes);
  const href = decodeEntities((match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim());
  return SAFE_HREF.test(href) ? href : undefined;
}

/** True when the value contains HTML tags, as opposed to plain text with line breaks. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(value);
}

export function parseRichText(html: string): RichTextNode[] {
  const root: RichTextNode[] = [];
  const stack: { tag: RichTextTag; children: RichTextNode[] }[] = [];
  const current = () => (stack.length ? stack[stack.length - 1].children : root);

  const pushText = (raw: string) => {
    const text = decodeEntities(raw);
    if (text) current().push({ type: 'text', text });
  };

  let position = 0;
  let dropping: string | null = null;
  TAG_PATTERN.lastIndex = 0;
  for (let match = TAG_PATTERN.exec(html); match; match = TAG_PATTERN.exec(html)) {
    const [whole, closing, rawName, attributes = ''] = match;
    if (!dropping) pushText(html.slice(position, match.index));
    position = match.index + whole.length;
    if (!rawName) continue; // comment

    const name = rawName.toLowerCase();
    if (dropping) {
      if (closing && name === dropping) dropping = null;
      continue;
    }
    if (DROP_CONTENT.has(name)) {
      if (!closing) dropping = name;
      continue;
    }

    const tag = TAG_ALIASES[name];
    if (!tag) continue; // unknown tag: keep its text, drop the tag

    if (closing) {
      const index = stack.map(entry => entry.tag).lastIndexOf(tag);
      if (index >= 0) stack.length = index; // also closes anything left open inside it
      continue;
    }

    if (tag === 'br' || VOID_TAGS.has(name)) {
      current().push({ type: 'element', tag: 'br', children: [] });
      continue;
    }

    // A new paragraph or list item ends an unclosed one of the same kind.
    if ((tag === 'p' || tag === 'li') && stack[stack.length - 1]?.tag === tag) stack.pop();

    const children: RichTextNode[] = [];
    const node: RichTextNode = { type: 'element', tag, children };
    if (tag === 'a') node.href = readHref(attributes);
    current().push(node);
    stack.push({ tag, children });
  }
  if (!dropping) pushText(html.slice(position));
  return root;
}

/** The copy without markup, for search and previews. */
export function richTextToPlain(value: string): string {
  if (!looksLikeHtml(value)) return value;
  const text = (nodes: RichTextNode[]): string =>
    nodes
      .map(node =>
        node.type === 'text'
          ? node.text
          : node.tag === 'br'
            ? '\n'
            : text(node.children) + (node.tag === 'p' || node.tag === 'li' ? '\n' : '')
      )
      .join('');
  return text(parseRichText(value))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
