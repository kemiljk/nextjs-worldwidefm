# Metadata Implementation Guide

This document outlines how to implement modern metadata using Next.js 13+ `generateMetadata` function across the Worldwide FM application.

## Overview

We've implemented a comprehensive metadata system that:
- Uses Next.js 13+ `generateMetadata` function for optimal SEO
- Integrates with Cosmic CMS for dynamic content
- Provides fallback metadata for all pages
- Includes Open Graph and Twitter Card support
- Follows SEO best practices

## File Structure

```
lib/
  metadata-utils.ts          # Reusable metadata templates
app/
  page.tsx                   # Homepage with metadata example
  [other-pages]/             # Other pages using metadata
```

## Core Metadata Utilities

### Base Configuration

All metadata functions use a common `BaseMetadataConfig` interface:

```typescript
interface BaseMetadataConfig {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  canonical?: string;
  noIndex?: boolean;
}
```

### Default Values

The system provides consistent defaults for Worldwide FM:

```typescript
const DEFAULT_METADATA = {
  siteName: "Worldwide FM",
  locale: "en_US",
  canonical: "https://worldwidefm.com",
  defaultImage: "/favicon.svg",
  defaultKeywords: ["radio", "music", "independent", "worldwide fm", "shows", "mixes", "playlists"],
} as const;
```

## Available Metadata Templates

### Page Templates

1. **Homepage**: `generateHomepageMetadata(cosmicData?)`
2. **About**: `generateAboutMetadata(cosmicData?)`
3. **Shows**: `generateShowsMetadata()`
4. **Episodes**: `generateEpisodesMetadata()`
5. **Editorial**: `generateEditorialMetadata()`
6. **Videos**: `generateVideosMetadata()`
7. **Schedule**: `generateScheduleMetadata()`
8. **Hosts**: `generateHostsMetadata()`
9. **Takeovers**: `generateTakeoversMetadata()`
10. **Events**: `generateEventsMetadata()`
11. **Contact**: `generateContactMetadata()`
12. **Privacy**: `generatePrivacyMetadata()`
13. **Terms**: `generateTermsMetadata()`

### Content Templates

1. **Individual Shows**: `generateShowMetadata(showData)`
2. **Individual Posts**: `generatePostMetadata(postData)`
3. **Individual Videos**: `generateVideoMetadata(videoData)`

## Implementation Examples

### Basic Page Implementation

```typescript
import { Metadata } from "next";
import { generateShowsMetadata } from "@/lib/metadata-utils";

export const generateMetadata = async (): Promise<Metadata> => {
  return generateShowsMetadata();
};

export default function ShowsPage() {
  // Your page component
}
```

### Page with Cosmic Data

```typescript
import { Metadata } from "next";
import { generateAboutMetadata } from "@/lib/metadata-utils";
import { getAboutData } from "@/lib/actions";

export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const aboutData = await getAboutData();
    return generateAboutMetadata(aboutData);
  } catch (error) {
    console.error("Error generating metadata:", error);
    return generateAboutMetadata();
  }
};

export default function AboutPage() {
  // Your page component
}
```

### Dynamic Route Implementation

```typescript
import { Metadata } from "next";
import { generateShowMetadata } from "@/lib/metadata-utils";
import { getShowBySlug } from "@/lib/actions";

interface Props {
  params: { slug: string };
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  try {
    const showData = await getShowBySlug(params.slug);
    return generateShowMetadata(showData);
  } catch (error) {
    console.error("Error generating metadata:", error);
    return generateShowMetadata();
  }
};

export default function ShowPage({ params }: Props) {
  // Your page component
}
```

## Metadata Features

### SEO Optimization

- **Title Tags**: Optimized for search engines
- **Meta Descriptions**: Compelling summaries for search results
- **Keywords**: Relevant search terms (though less important for modern SEO)
- **Canonical URLs**: Prevents duplicate content issues

### Social Media

- **Open Graph**: Facebook, LinkedIn, and other platforms
- **Twitter Cards**: Optimized Twitter sharing
- **Image Optimization**: Proper dimensions and alt text

### Search Engine Control

- **Robots**: Control indexing and following
- **Google Bot**: Specific instructions for Google
- **No-Index**: For privacy and terms pages

## Best Practices

### 1. Always Use Try-Catch

```typescript
export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const data = await fetchData();
    return generateTemplateMetadata(data);
  } catch (error) {
    console.error("Error generating metadata:", error);
    return generateTemplateMetadata(); // Fallback
  }
};
```

### 2. Provide Fallbacks

Every metadata function should work without data:

```typescript
export function generateShowsMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Shows - Worldwide FM",
    description: "Default description for shows page",
    // ... other defaults
  });
}
```

### 3. Use Cosmic Data When Available

Enhance metadata with dynamic content:

```typescript
if (cosmicData?.metadata?.hero_image?.imgix_url) {
  baseConfig.image = cosmicData.metadata.hero_image.imgix_url;
}
```

### 4. Consistent Naming

- Use "Worldwide FM" suffix for all titles
- Keep descriptions under 160 characters
- Use relevant keywords for each page type

## Adding New Page Types

To add metadata for a new page type:

1. **Add the function to `metadata-utils.ts`**:

```typescript
export function generateNewPageMetadata(): Metadata {
  return generateBaseMetadata({
    title: "New Page - Worldwide FM",
    description: "Description for the new page",
    keywords: ["relevant", "keywords", "worldwide fm"],
  });
}
```

2. **Use it in your page**:

```typescript
import { generateNewPageMetadata } from "@/lib/metadata-utils";

export const generateMetadata = async (): Promise<Metadata> => {
  return generateNewPageMetadata();
};
```

## Testing Metadata

### Development

- Check browser dev tools for meta tags
- Use social media debugging tools:
  - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
  - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
  - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### Production

- Verify metadata appears in search results
- Test social media sharing
- Check Google Search Console for indexing

## Troubleshooting

### Common Issues

1. **Metadata not updating**: Check revalidation settings
2. **Images not showing**: Verify image URLs and dimensions
3. **Type errors**: Ensure proper TypeScript types from Next.js

### Debugging

```typescript
export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const data = await fetchData();
    console.log("Metadata data:", data); // Debug log
    return generateTemplateMetadata(data);
  } catch (error) {
    console.error("Metadata error:", error);
    return generateTemplateMetadata();
  }
};
```

## Future Enhancements

- **Structured Data**: Add JSON-LD for rich snippets
- **Internationalization**: Support for multiple languages
- **Dynamic Keywords**: Generate keywords from content
- **Analytics Integration**: Track metadata performance

## Resources

- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [SEO Best Practices](https://developers.google.com/search/docs/advanced/guidelines/overview)
