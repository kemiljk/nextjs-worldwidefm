const HTML_TAG = /<(p|br|div|ul|ol|h[1-6]|a|strong|em)\b/i;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Plain-text copy → HTML paragraphs, keeping line breaks.
 * Copy that already contains HTML (e.g. from a rich-text field) is returned as written.
 * Callers render the result through the sanitiser.
 */
export function plainTextToHtml(text: string | null | undefined): string {
  const trimmed = text?.trim();
  if (!trimmed) return '';
  if (HTML_TAG.test(trimmed)) return trimmed;

  return trimmed
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(paragraph => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br />')}</p>`)
    .join('');
}
