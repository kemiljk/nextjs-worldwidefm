// Tracklists are edited as plain text (one track per line) and stored as HTML.
// Blank lines are dropped both ways: Cosmic's rich-text editor puts a newline
// between every <p>, and pasted tracklists often carry spacer lines.

function toLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function tracklistTextToHtml(text: string): string {
  return toLines(text.replace(/\r\n?/g, '\n')).join('<br />');
}

export function tracklistHtmlToText(html: string): string {
  const text = html
    .replace(/\r?\n/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');

  return toLines(text).join('\n');
}
