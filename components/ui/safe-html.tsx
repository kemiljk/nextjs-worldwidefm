import React from 'react';
import {
  sanitizeTracklist,
  sanitizeEditorialContent,
  sanitizeEditorialWithEmbeds,
} from '../../lib/sanitize-html';

interface SafeHtmlProps {
  content: string;
  type?: 'tracklist' | 'editorial' | 'editorial-with-embeds' | 'default';
  className?: string;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export function SafeHtml({
  content,
  type = 'default',
  className = '',
  allowedTags,
  allowedAttributes,
}: SafeHtmlProps) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  let sanitizedContent: string;

  switch (type) {
    case 'tracklist':
      sanitizedContent = sanitizeTracklist(content);
      break;
    case 'editorial':
      sanitizedContent = sanitizeEditorialContent(content);
      break;
    case 'editorial-with-embeds':
      sanitizedContent = sanitizeEditorialWithEmbeds(content);
      break;
    default:
      sanitizedContent = content; // Assume already sanitized
      break;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
}

// Client-side only component for when you need to sanitize on the client
export function SafeHtmlClient({
  content,
  type = 'default',
  className = '',
  allowedTags,
  allowedAttributes,
}: SafeHtmlProps) {
  const [sanitizedContent, setSanitizedContent] = React.useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Client-side sanitization using the same logic
      let sanitized: string;

      switch (type) {
        case 'tracklist':
          sanitized = sanitizeTracklist(content);
          break;
        case 'editorial':
          sanitized = sanitizeEditorialContent(content);
          break;
        case 'editorial-with-embeds':
          sanitized = sanitizeEditorialWithEmbeds(content);
          break;
        default:
          sanitized = content;
          break;
      }

      setSanitizedContent(sanitized);
    }
  }, [content, type]);

  if (!sanitizedContent) {
    return null;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
}
