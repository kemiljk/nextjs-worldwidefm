import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

// Server-side DOMPurify setup
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  allowedSchemes?: string[];
}

export const defaultSanitizeOptions: SanitizeOptions = {
  allowedTags: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'a', 'img', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's',
    'blockquote', 'pre', 'code', 'kbd', 'samp',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'caption', 'colgroup', 'col'
  ],
  allowedAttributes: [
    'href', 'src', 'alt', 'title', 'width', 'height',
    'class', 'id', 'style', 'target', 'rel',
    'data-*', 'aria-*'
  ],
  allowedSchemes: ['http', 'https', 'mailto', 'tel']
};

export function sanitizeHtml(
  html: string,
  options: SanitizeOptions = {}
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const mergedOptions = { ...defaultSanitizeOptions, ...options };

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: mergedOptions.allowedTags,
    ALLOWED_ATTR: mergedOptions.allowedAttributes,
    ALLOWED_URI_REGEXP: new RegExp(
      `^(${mergedOptions.allowedSchemes.join('|')}):`,
      'i'
    ),
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  });
}

export function sanitizeTracklist(html: string): string {
  // Specific sanitization for tracklists with more permissive tags
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'a', 'img', 'br', 'hr', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's',
      'blockquote', 'pre', 'code', 'kbd', 'samp',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'caption', 'colgroup', 'col'
    ],
    allowedAttributes: [
      'href', 'src', 'alt', 'title', 'width', 'height',
      'class', 'id', 'style', 'target', 'rel',
      'data-*', 'aria-*'
    ]
  });
}

export function sanitizeEditorialContent(html: string): string {
  // More restrictive sanitization for editorial content
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'a', 'img', 'br', 'hr', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's',
      'blockquote', 'pre', 'code'
    ],
    allowedAttributes: [
      'href', 'src', 'alt', 'title', 'class', 'id'
    ]
  });
}
