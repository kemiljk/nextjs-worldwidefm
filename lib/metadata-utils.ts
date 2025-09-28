import { metadata } from "./../app/layout";
import { Metadata } from "next";

// Base metadata configuration that can be extended
export interface BaseMetadataConfig {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  canonical?: string;
  noIndex?: boolean;
}

// Default metadata values for Worldwide FM
export const DEFAULT_METADATA = {
  siteName: "Worldwide FM",
  locale: "en_US",
  canonical: "https://worldwidefm.com",
  defaultImage: "/favicon.svg",
  defaultKeywords: ["radio", "music", "independent", "worldwide fm", "shows", "mixes", "playlists"],
} as const;

// Generate base metadata with fallbacks
export function generateBaseMetadata(config: BaseMetadataConfig): Metadata {
  const { title, description, keywords = DEFAULT_METADATA.defaultKeywords, image = DEFAULT_METADATA.defaultImage, canonical = DEFAULT_METADATA.canonical, noIndex = false } = config;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: DEFAULT_METADATA.locale,
      siteName: DEFAULT_METADATA.siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: noIndex
      ? "noindex, nofollow"
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large" as const,
            "max-snippet": -1,
          },
        },
    alternates: {
      canonical,
    },
  };
}

// Template for homepage metadata
export function generateHomepageMetadata(cosmicData?: any): Metadata {
  const baseConfig: BaseMetadataConfig = {
    title: cosmicData?.metadata?.seo.title || "Worldwide FM - Independent Radio Station",
    description: "Listen to the best independent music, shows, and content from Worldwide FM. Discover new artists, exclusive mixes, and curated playlists.",
    keywords: ["radio", "music", "independent", "worldwide fm", "shows", "mixes", "playlists", "live radio", "music discovery"],
  };

  // Try to get a hero image from Cosmic data
  if (cosmicData?.metadata?.heroItems?.[0]?.metadata?.image?.imgix_url) {
    baseConfig.image = cosmicData.metadata.heroItems[0].metadata.image.imgix_url;
  }

  return generateBaseMetadata(baseConfig);
}

// Template for about page metadata
export function generateAboutMetadata(cosmicData?: any): Metadata {
  const baseConfig: BaseMetadataConfig = {
    title: cosmicData?.metadata?.seo.title || "About - Worldwide FM",
    description: cosmicData?.metadata?.mission_content || "Learn about Worldwide FM's mission to promote independent music and provide a platform for emerging artists and established musicians alike.",
    keywords: ["about", "mission", "worldwide fm", "independent radio", "music platform", "artist support"],
  };

  if (cosmicData?.metadata?.hero_image?.imgix_url) {
    baseConfig.image = cosmicData.metadata.hero_image.imgix_url;
  }

  return generateBaseMetadata(baseConfig);
}

// Template for shows/shows page metadata
export function generateShowsMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Shows - Worldwide FM",
    description: "Explore our curated collection of radio shows featuring independent music, exclusive mixes, and interviews with emerging artists.",
    keywords: ["shows", "radio shows", "music programs", "mixes", "interviews", "worldwide fm"],
  });
}

// Template for episodes page metadata
export function generateEpisodesMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Episodes - Worldwide FM",
    description: "Listen to the latest episodes from Worldwide FM shows. Discover new music, exclusive content, and archived broadcasts.",
    keywords: ["episodes", "radio episodes", "archived shows", "music content", "worldwide fm"],
  });
}

// Template for editorial/posts page metadata
export function generateEditorialMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Editorial - Worldwide FM",
    description: "Read articles, interviews, and features about independent music, artists, and the music industry from Worldwide FM.",
    keywords: ["editorial", "articles", "interviews", "music features", "music journalism", "worldwide fm"],
  });
}

// Template for videos page metadata
export function generateVideosMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Videos - Worldwide FM",
    description: "Watch music videos, live performances, and exclusive content from independent artists featured on Worldwide FM.",
    keywords: ["videos", "music videos", "live performances", "exclusive content", "worldwide fm"],
  });
}

// Template for schedule page metadata
export function generateScheduleMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Schedule - Worldwide FM",
    description: "View the weekly schedule of shows, special events, and live broadcasts on Worldwide FM.",
    keywords: ["schedule", "radio schedule", "show times", "live broadcasts", "worldwide fm"],
  });
}

// Template for hosts page metadata
export function generateHostsMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Hosts - Worldwide FM",
    description: "Meet the talented hosts, DJs, and presenters who bring you the best independent music on Worldwide FM.",
    keywords: ["hosts", "djs", "presenters", "radio personalities", "worldwide fm"],
  });
}

// Template for takeovers page metadata
export function generateTakeoversMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Takeovers - Worldwide FM",
    description: "Experience special takeovers and guest programming featuring curated music selections from artists and DJs.",
    keywords: ["takeovers", "guest programming", "curated music", "special shows", "worldwide fm"],
  });
}

// Template for events page metadata
export function generateEventsMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Events - Worldwide FM",
    description: "Stay updated on live events, concerts, and special performances featuring artists from the Worldwide FM community.",
    keywords: ["events", "concerts", "live performances", "music events", "worldwide fm"],
  });
}

// Template for contact page metadata
export function generateContactMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Contact - Worldwide FM",
    description: "Get in touch with Worldwide FM. We'd love to hear from you about music submissions, partnerships, or general inquiries.",
    keywords: ["contact", "get in touch", "music submissions", "partnerships", "worldwide fm"],
  });
}

// Template for privacy policy page metadata
export function generatePrivacyMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Privacy Policy - Worldwide FM",
    description: "Learn about how Worldwide FM collects, uses, and protects your personal information.",
    keywords: ["privacy policy", "data protection", "personal information", "worldwide fm"],
    noIndex: true, // Privacy pages typically shouldn't be indexed
  });
}

// Template for terms of service page metadata
export function generateTermsMetadata(): Metadata {
  return generateBaseMetadata({
    title: "Terms of Service - Worldwide FM",
    description: "Read the terms and conditions governing your use of Worldwide FM's services and content.",
    keywords: ["terms of service", "terms and conditions", "user agreement", "worldwide fm"],
    noIndex: true, // Terms pages typically shouldn't be indexed
  });
}

// Template for individual show/episode metadata
export function generateShowMetadata(showData: any): Metadata {
  const title = showData?.metadata?.seo.title || "Show - Worldwide FM";
  const description = showData?.metadata?.description || showData?.metadata?.subtitle || `Listen to ${title} on Worldwide FM`;

  return generateBaseMetadata({
    title: `${title} - Worldwide FM`,
    description,
    keywords: ["radio show", "music", "worldwide fm", title.toLowerCase()],
    image: showData?.metadata?.image?.imgix_url,
  });
}

// Template for individual post/article metadata
export function generatePostMetadata(postData: any): Metadata {
  const title = postData?.metadata?.seo.title || "Article - Worldwide FM";
  const description = postData?.metadata?.excerpt || postData?.metadata?.description || `Read ${title} on Worldwide FM`;

  return generateBaseMetadata({
    title: `${title} - Worldwide FM`,
    description,
    keywords: ["article", "music journalism", "worldwide fm", title.toLowerCase()],
    image: postData?.metadata?.image?.imgix_url,
  });
}

// Template for individual video metadata
export function generateVideoMetadata(videoData: any): Metadata {
  const title = videoData?.title || "Video - Worldwide FM";
  const description = videoData?.metadata?.description || `Watch ${title} on Worldwide FM`;

  return generateBaseMetadata({
    title: `${title} - Worldwide FM`,
    description,
    keywords: ["video", "music video", "worldwide fm", title.toLowerCase()],
    image: videoData?.metadata?.image?.imgix_url,
  });
}
