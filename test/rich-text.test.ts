import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { looksLikeHtml, parseRichText, richTextToPlain } from '@/lib/rich-text';
import { VideoCaption } from '@/components/video/video-caption';

const render = (description: string) =>
  renderToStaticMarkup(createElement(VideoCaption, { description }));

describe('looksLikeHtml', () => {
  it('tells rich text from plain text', () => {
    expect(looksLikeHtml('<p>Hello</p>')).toBe(true);
    expect(looksLikeHtml('Line one\nLine two https://example.com')).toBe(false);
    expect(looksLikeHtml('Tom & Jerry, 5 < 6 and 7 > 3')).toBe(false);
  });
});

describe('VideoCaption', () => {
  it('renders formatting and named hyperlinks from rich text', () => {
    const html = render(
      '<p>Watch <strong>Lady Wray</strong> live. <a href="https://example.com/ep">Full session</a></p><p>Second <em>paragraph</em></p>'
    );
    expect(html).toContain('<strong>Lady Wray</strong>');
    expect(html).toContain(
      '<a href="https://example.com/ep" target="_blank" rel="noopener noreferrer">Full session</a>'
    );
    expect(html).toContain('<em>paragraph</em>');
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it('renders lists', () => {
    const html = render('<ul><li>One</li><li>Two</li></ul>');
    expect(html).toContain('<li>One</li><li>Two</li>');
  });

  it('never outputs scripts, event handlers or unsafe links', () => {
    const html = render(
      '<p onclick="steal()">Hi <script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://ok.example" onmouseover="x()">ok</a><img src=x onerror=alert(1)><iframe src="https://evil.example"></iframe></p>'
    );
    expect(html).not.toContain('script');
    expect(html).not.toContain('alert');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onmouseover');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('iframe');
    expect(html).toContain('href="https://ok.example"');
    expect(html).toContain('bad'); // the text of a blocked link is kept
  });

  it('escapes text instead of treating it as markup', () => {
    const html = render('<p>&lt;b&gt;not bold&lt;/b&gt; &amp; fine</p>');
    expect(html).toContain('&lt;b&gt;not bold&lt;/b&gt; &amp; fine');
    expect(html).not.toContain('<b>');
  });

  it('does not double-link a URL that is already a link', () => {
    const html = render('<p><a href="https://example.com">https://example.com</a></p>');
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it('still links bare URLs in rich text and keeps plain text behaviour', () => {
    expect(render('<p>See https://example.com/x now</p>')).toContain(
      '<a href="https://example.com/x"'
    );
    const plain = render('First line\nSecond line\n\nNew paragraph https://example.com');
    expect(plain.match(/<p>/g)).toHaveLength(2);
    expect(plain).toContain('<br/>');
    expect(plain).toContain('<a href="https://example.com"');
  });

  it('handles unclosed and mismatched tags without throwing', () => {
    expect(() => render('<p>one<p>two <strong>bold</em> text')).not.toThrow();
    expect(parseRichText('<p>one<p>two')).toHaveLength(2);
  });
});

describe('richTextToPlain', () => {
  it('flattens markup for search', () => {
    expect(richTextToPlain('<p>Hello <strong>world</strong></p><p>Next</p>')).toBe(
      'Hello world\nNext'
    );
    expect(richTextToPlain('plain text')).toBe('plain text');
  });
});
