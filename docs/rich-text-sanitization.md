# Rich Text and HTML Sanitization

This document outlines how to use Rich Text content safely in the Worldwide FM application, including server-side sanitization and client-side rendering.

## Overview

The application now supports Rich Text content for tracklists and editorial content with built-in HTML sanitization to prevent XSS attacks. All HTML content is sanitized server-side before being stored or rendered.

## Key Components

### 1. HTML Sanitization Utility (`lib/sanitize-html.ts`)

The core sanitization utility uses DOMPurify with JSDOM for server-side HTML sanitization.

```typescript
import { sanitizeTracklist, sanitizeEditorialContent } from '@/lib/sanitize-html';

// Sanitize tracklist content (more permissive)
const cleanTracklist = sanitizeTracklist(rawHtml);

// Sanitize editorial content (more restrictive)
const cleanEditorial = sanitizeEditorialContent(rawHtml);
```

### 2. Safe HTML Component (`components/ui/safe-html.tsx`)

React components that safely render sanitized HTML content:

```tsx
import { SafeHtml } from '@/components/ui/safe-html';

// For tracklists
<SafeHtml
  content={metadata.tracklist}
  type="tracklist"
  className="prose dark:prose-invert"
/>

// For editorial content
<SafeHtml
  content={metadata.body_text}
  type="editorial"
  className="prose dark:prose-invert"
/>
```

### 3. API Route for Server-Side Sanitization

Use the `/api/sanitize-content` endpoint for server-side sanitization:

```typescript
// POST to /api/sanitize-content
const response = await fetch('/api/sanitize-content', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '<p>Raw HTML content</p>',
    type: 'tracklist' // or 'editorial'
  })
});

const { sanitizedContent } = await response.json();
```

## Migration Script

The tracklist migration script (`scripts/migrate-tracklist.ts`) now automatically sanitizes content before storing it in Cosmic CMS:

```typescript
// Content is automatically sanitized during migration
const sanitizedTracklist = sanitizeTracklist(tracklistOld);

await cosmic.objects.updateOne(episode.id, {
  metadata: {
    tracklist: sanitizedTracklist,
  },
});
```

## Allowed HTML Tags and Attributes

### Tracklists (More Permissive)
- **Tags**: p, h1-h6, ul, ol, li, dl, dt, dd, a, img, br, hr, div, span, strong, b, em, i, u, s, blockquote, pre, code, kbd, samp, table, thead, tbody, tr, th, td, caption, colgroup, col
- **Attributes**: href, src, alt, title, width, height, class, id, style, target, rel, data-*, aria-*

### Editorial Content (More Restrictive)
- **Tags**: p, h1-h6, ul, ol, li, dl, dt, dd, a, img, br, hr, div, span, strong, b, em, i, u, s, blockquote, pre, code
- **Attributes**: href, src, alt, title, class, id

## Best Practices

1. **Always sanitize HTML content server-side** before storing in the database
2. **Use the appropriate sanitization type** (tracklist vs editorial) based on content purpose
3. **Render content using SafeHtml components** instead of dangerouslySetInnerHTML
4. **Validate content structure** before sending to sanitization functions
5. **Test sanitization** with various HTML inputs to ensure security

## Example Usage in Components

### Episode Page
```tsx
// Before (unsafe)
<div dangerouslySetInnerHTML={{ __html: metadata.tracklist }} />

// After (safe)
<SafeHtml
  content={metadata.tracklist}
  type="tracklist"
  className="prose dark:prose-invert"
/>
```

### Editorial Content
```tsx
// Before (unsafe)
<div dangerouslySetInnerHTML={{ __html: content }} />

// After (safe)
<SafeHtml
  content={content}
  type="editorial"
  className="prose prose-lg dark:prose-invert"
/>
```

## Security Considerations

- All HTML content is sanitized server-side before storage
- Client-side rendering uses pre-sanitized content
- DOMPurify removes potentially malicious scripts and attributes
- Content is validated for proper HTML structure
- XSS attacks are prevented through comprehensive sanitization

## Troubleshooting

### Common Issues

1. **Content not rendering**: Check if content is properly sanitized and stored
2. **Styling issues**: Ensure CSS classes are in the allowed attributes list
3. **Missing content**: Verify content type matches expected format

### Debug Sanitization

Use the API endpoint to test sanitization:

```bash
curl -X POST http://localhost:3000/api/sanitize-content \
  -H "Content-Type: application/json" \
  -d '{"content": "<p>Test content</p>", "type": "tracklist"}'
```

## Future Enhancements

- Custom sanitization rules for specific content types
- Content validation schemas
- Rich text editor integration
- Content preview with sanitization
