/**
 * Flexible content blocks for the membership page, edited in Cosmic as a repeater.
 * Cosmic returns select fields as plain strings or {key, value} objects depending on
 * depth, and editors can leave anything empty, so everything here is tolerant and
 * never trusts a link.
 */
export type MembershipBlock =
  | { type: 'text'; heading: string; body: string }
  | {
      type: 'image-text';
      heading: string;
      body: string;
      imageUrl: string;
      imagePosition: 'left' | 'right';
    }
  | { type: 'cta'; heading: string; body: string; buttonText: string; buttonHref: string }
  | { type: 'faq'; heading: string; body: string };

type Raw = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function choice(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const option = value as { value?: unknown; key?: unknown };
    return text(option.value) || text(option.key);
  }
  return '';
}

function normaliseType(value: unknown): MembershipBlock['type'] | null {
  const key = choice(value)
    .toLowerCase()
    .replace(/[^a-z]+/g, '');
  if (key === 'text') return 'text';
  if (key === 'imageandtext' || key === 'imagetext') return 'image-text';
  if (key === 'calltoaction' || key === 'cta') return 'cta';
  if (key === 'faq') return 'faq';
  return null;
}

/** Only on-site paths and http(s)/mailto links are allowed as buttons. */
export function safeBlockHref(value: unknown): string {
  const href = text(value);
  if (/^\/(?!\/)/.test(href) || /^(https?:\/\/|mailto:)/i.test(href)) return href;
  return '';
}

function imageUrl(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const image = value as { imgix_url?: unknown; url?: unknown };
    return text(image.imgix_url) || text(image.url);
  }
  return '';
}

export function parseMembershipBlocks(raw: unknown): MembershipBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: MembershipBlock[] = [];

  for (const entry of raw as Raw[]) {
    if (!entry || typeof entry !== 'object') continue;
    const type = normaliseType(entry.type ?? entry.block_type);
    const heading = text(entry.heading);
    const body = text(entry.body);
    if (!type) continue;

    switch (type) {
      case 'text':
        if (heading || body) blocks.push({ type, heading, body });
        break;
      case 'image-text': {
        const image = imageUrl(entry.image);
        if (!image && !heading && !body) break;
        blocks.push({
          type,
          heading,
          body,
          imageUrl: image,
          imagePosition: choice(entry.image_position).toLowerCase() === 'left' ? 'left' : 'right',
        });
        break;
      }
      case 'cta': {
        const buttonHref = safeBlockHref(entry.button_link);
        const buttonText = text(entry.button_text);
        if (!heading && !body && !buttonHref) break;
        blocks.push({
          type,
          heading,
          body,
          buttonText: buttonHref ? buttonText || 'Find out more' : '',
          buttonHref,
        });
        break;
      }
      case 'faq':
        // A question needs an answer to be worth showing.
        if (heading && body) blocks.push({ type, heading, body });
        break;
    }
  }
  return blocks;
}

/** Consecutive FAQ blocks are shown together as one list. */
export type MembershipBlockGroup =
  | { kind: 'block'; block: Exclude<MembershipBlock, { type: 'faq' }> }
  | { kind: 'faq'; items: Extract<MembershipBlock, { type: 'faq' }>[] };

export function groupMembershipBlocks(blocks: MembershipBlock[]): MembershipBlockGroup[] {
  const groups: MembershipBlockGroup[] = [];
  for (const block of blocks) {
    if (block.type !== 'faq') {
      groups.push({ kind: 'block', block });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.kind === 'faq') last.items.push(block);
    else groups.push({ kind: 'faq', items: [block] });
  }
  return groups;
}
