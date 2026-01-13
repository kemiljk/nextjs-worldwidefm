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
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'a',
    'img',
    'br',
    'hr',
    'div',
    'span',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'blockquote',
    'pre',
    'code',
    'kbd',
    'samp',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
  ],
  allowedAttributes: [
    'href',
    'src',
    'alt',
    'title',
    'width',
    'height',
    'class',
    'id',
    'style',
    'target',
    'rel',
    'data-*',
    'aria-*',
  ],
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
};

export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const mergedOptions = { ...defaultSanitizeOptions, ...options };
  const allowedSchemes =
    mergedOptions.allowedSchemes && mergedOptions.allowedSchemes.length > 0
      ? mergedOptions.allowedSchemes
      : defaultSanitizeOptions.allowedSchemes || ['http', 'https'];

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: mergedOptions.allowedTags,
    ALLOWED_ATTR: mergedOptions.allowedAttributes,
    ALLOWED_URI_REGEXP: new RegExp(`^(${allowedSchemes.join('|')}):`, 'i'),
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

export function sanitizeTracklist(html: string): string {
  // Specific sanitization for tracklists with more permissive tags
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      'a',
      'img',
      'br',
      'hr',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'pre',
      'code',
      'kbd',
      'samp',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'caption',
      'colgroup',
      'col',
    ],
    allowedAttributes: [
      'href',
      'src',
      'alt',
      'title',
      'width',
      'height',
      'class',
      'id',
      'style',
      'target',
      'rel',
      'data-*',
      'aria-*',
    ],
  });
}

export function sanitizeEditorialContent(html: string): string {
  // More restrictive sanitization for editorial content
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      'a',
      'img',
      'br',
      'hr',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'pre',
      'code',
    ],
    allowedAttributes: ['href', 'src', 'alt', 'title', 'class', 'id'],
  });
}

export function sanitizeEditorialWithEmbeds(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let cleaned = html;
  
  cleaned = cleaned.replace(/<a[^>]*class=["']embedly-card["'][^>]*>.*?<\/a>/gi, '');
  
  cleaned = cleaned.replace(/<a[^>]*data-card-branding[^>]*>.*?<\/a>/gi, '');

  return DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      'a',
      'img',
      'br',
      'hr',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'pre',
      'code',
      'iframe',
      'figure',
      'figcaption',
    ],
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'class',
      'id',
      'width',
      'height',
      'frameborder',
      'allow',
      'allowfullscreen',
      'loading',
      'referrerpolicy',
      'sandbox',
      'style',
      'scrolling',
      'data-*',
      'rel',
      'target',
    ],
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
    ADD_URI_SAFE_ATTR: ['src'],
    SAFE_FOR_TEMPLATES: false,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}
