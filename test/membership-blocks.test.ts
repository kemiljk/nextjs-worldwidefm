import { describe, expect, it, mock } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('server-only', () => ({}));

const { groupMembershipBlocks, parseMembershipBlocks, safeBlockHref } = await import(
  '@/lib/membership-blocks'
);
const { MembershipBlocks } = await import('@/components/membership-blocks');

const render = (blocks: unknown) =>
  renderToStaticMarkup(createElement(MembershipBlocks, { blocks }));

describe('parseMembershipBlocks', () => {
  it('reads each block type, whether selects arrive as strings or {key, value}', () => {
    const blocks = parseMembershipBlocks([
      { type: 'text', heading: 'Why join', body: '<p>Support independent radio.</p>' },
      {
        type: { key: 'Image and text', value: 'image-text' },
        heading: 'Behind the scenes',
        body: '<p>Meet the team.</p>',
        image: { imgix_url: 'https://imgix.cosmicjs.com/team.jpg' },
        image_position: { key: 'Left', value: 'left' },
      },
      {
        type: 'cta',
        heading: 'Ready?',
        button_text: 'Join now',
        button_link: '/membership',
      },
      { type: 'faq', heading: 'Can I cancel?', body: '<p>Anytime.</p>' },
    ]);

    expect(blocks.map(block => block.type)).toEqual(['text', 'image-text', 'cta', 'faq']);
    expect(blocks[1]).toMatchObject({
      imageUrl: 'https://imgix.cosmicjs.com/team.jpg',
      imagePosition: 'left',
    });
    expect(blocks[2]).toMatchObject({ buttonText: 'Join now', buttonHref: '/membership' });
  });

  it('skips blocks that would render empty or are not understood', () => {
    expect(
      parseMembershipBlocks([
        { type: 'text' },
        { type: 'faq', heading: 'Question with no answer' },
        { type: 'mystery', heading: 'Unknown' },
        { type: 'cta' },
        null,
        'oops',
      ])
    ).toEqual([]);
    expect(parseMembershipBlocks(undefined)).toEqual([]);
    expect(parseMembershipBlocks({})).toEqual([]);
  });

  it('only allows safe button links, and drops the button when the link is unsafe', () => {
    expect(safeBlockHref('/shows')).toBe('/shows');
    expect(safeBlockHref('https://example.com')).toBe('https://example.com');
    expect(safeBlockHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(safeBlockHref('javascript:alert(1)')).toBe('');
    expect(safeBlockHref('//evil.example')).toBe('');
    expect(safeBlockHref('shows')).toBe('');

    const [block] = parseMembershipBlocks([
      { type: 'cta', heading: 'Hi', button_text: 'Go', button_link: 'javascript:alert(1)' },
    ]);
    expect(block).toMatchObject({ buttonHref: '', buttonText: '' });
  });
});

describe('groupMembershipBlocks', () => {
  it('collects neighbouring FAQs into one list', () => {
    const groups = groupMembershipBlocks(
      parseMembershipBlocks([
        { type: 'text', heading: 'Intro' },
        { type: 'faq', heading: 'One?', body: 'a' },
        { type: 'faq', heading: 'Two?', body: 'b' },
        { type: 'text', heading: 'Outro' },
        { type: 'faq', heading: 'Three?', body: 'c' },
      ])
    );
    expect(
      groups.map(group => (group.kind === 'faq' ? group.items.length : group.block.type))
    ).toEqual(['text', 2, 'text', 1]);
  });
});

describe('MembershipBlocks', () => {
  it('renders nothing when there are no blocks', () => {
    expect(render(undefined)).toBe('');
    expect(render([])).toBe('');
  });

  it('renders headings, copy, a CTA link and FAQs as native disclosure elements', () => {
    const html = render([
      {
        type: 'text',
        heading: 'Why join',
        body: '<p>Support <strong>independent</strong> radio.</p>',
      },
      { type: 'cta', heading: 'Ready?', button_text: 'Join now', button_link: '/membership' },
      { type: 'faq', heading: 'Can I cancel?', body: '<p>Anytime.</p>' },
    ]);

    expect(html).toContain('Why join');
    expect(html).toContain('<strong>independent</strong>');
    expect(html).toContain('href="/membership"');
    expect(html).toContain('Join now');
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
  });

  it('sanitises editor HTML', () => {
    const html = render([
      {
        type: 'text',
        heading: 'Hello',
        body: '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>',
      },
    ]);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Hi');
  });

  it('opens external CTA links safely in a new tab', () => {
    const html = render([
      {
        type: 'cta',
        heading: 'Read',
        button_text: 'Press',
        button_link: 'https://example.com/press',
      },
    ]);
    expect(html).toContain('href="https://example.com/press"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
