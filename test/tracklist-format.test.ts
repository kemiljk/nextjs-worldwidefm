import { describe, expect, it } from 'bun:test';
import { tracklistHtmlToText, tracklistTextToHtml } from '@/lib/tracklist-format';

describe('tracklistHtmlToText', () => {
  it('does not add blank lines between Cosmic rich-text paragraphs', () => {
    expect(tracklistHtmlToText('<p>Artist A - Track 1</p>\n<p>Artist B - Track 2</p>\n')).toBe(
      'Artist A - Track 1\nArtist B - Track 2'
    );
  });

  it('drops spacer lines and empty paragraphs', () => {
    expect(
      tracklistHtmlToText(
        'Artist A - One<br /><br />Artist B - Two<br /><p>&nbsp;</p><p>C - Three</p>'
      )
    ).toBe('Artist A - One\nArtist B - Two\nC - Three');
  });

  it('decodes entities once', () => {
    expect(
      tracklistHtmlToText('<p>Simon &amp; Garfunkel - &quot;Boxer&quot; &amp;lt;edit&amp;gt;</p>')
    ).toBe('Simon & Garfunkel - "Boxer" &lt;edit&gt;');
  });
});

describe('tracklistTextToHtml', () => {
  it('joins tracks with single line breaks, ignoring blank and CRLF lines', () => {
    expect(tracklistTextToHtml('A - One\r\n\r\n  B - Two  \n\n\nC - Three\n')).toBe(
      'A - One<br />B - Two<br />C - Three'
    );
  });

  it('round-trips without growing blank lines', () => {
    const text = 'A - One\nB - Two';
    expect(tracklistHtmlToText(tracklistTextToHtml(text))).toBe(text);
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(tracklistTextToHtml(' \n\n ')).toBe('');
  });
});
