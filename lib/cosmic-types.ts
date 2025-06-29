export interface CosmicObjectMeta {
  [key: string]: any; // Allows for flexible metadata not strictly typed yet
  image?: {
    url: string;
  };
  // Add other known metadata properties if they become clear
  // e.g., subtitle, description, featured_on_homepage, genres, locations, etc. for shows
  // e.g., featured_image for posts
}

export interface CosmicItem {
  slug: string;
  title: string;
  type: string; // e.g., "radio-shows", "posts"
  metadata: CosmicObjectMeta;
}

export interface HomepageHeroItem extends CosmicItem {
  // Specific properties for hero items if any, otherwise defaults to CosmicItem
}

export interface HomepageSectionItem extends CosmicItem {
  // Specific properties for section items if any, otherwise defaults to CosmicItem
}

export interface HomepageSection {
  is_active: boolean;
  title: string;
  type: string; // e.g., "Shows", "Editorial", "Custom"
  layout: "Grid" | "Carousel" | "List" | "FullWidth"; // Added "FullWidth"
  itemsPerRow: number;
  items: string[];
}

export interface ProcessedHomepageSection extends Omit<HomepageSection, "items"> {
  items: HomepageSectionItem[];
}

export interface CosmicHomepageData {
  slug: "homepage";
  title: "Homepage";
  type: "homepage";
  metadata: {
    heroLayout: "Split" | "FullWidth" | "Full Width" | "Carousel" | string; // Added "Full Width" with a space
    heroItems: HomepageHeroItem[];
    sections: HomepageSection[];
  };
}

// Individual type for a Cosmic API response for a single object
export interface CosmicAPIObject<T> {
  object: T;
}

export type EventType = {
  slug: string;
  title: string;
  type: "events";
  metadata: {
    image: null | string;
    event_date: string;
    location: string;
    description: string;
    ticket_link: string;
    featured_on_homepage: boolean;
  };
};

export type PostType = {
  slug: string;
  title: string;
  type: "posts";
  metadata: {
    type: {
      key: "article";
      value: "Article";
    };
    categories: any[]; // Consider defining a more specific type if the structure of categories is known
    image: {
      url: string;
      imgix_url: string;
    };
    author: null | any; // Consider defining a more specific type if the structure of author is known
    date: string;
    excerpt: string;
    content: string;
    featured_on_homepage: boolean;
    is_featured: boolean;
    featured_size: {
      key: "small";
      value: "Small";
    };
    section_name: {
      id: string;
      slug: string;
      title: string;
      content: string;
      bucket: string;
      created_at: string;
      modified_at: string;
      status: string;
      published_at: string;
      modified_by: string;
      created_by: string;
      type: "sections";
      metadata: null;
    }[];
    section_priority: number;
    display_style: {
      key: "standard";
      value: "Standard";
    };
    image_aspect_ratio: {
      key: "1_1";
      value: "Square";
    };
  };
};

export type VideoType = {
  slug: string;
  title: string;
  type: "videos";
  metadata: {
    categories: {
      id: string;
      slug: string;
      title: string;
      content: string;
      bucket: string;
      created_at: string;
      modified_at: string;
      status: string;
      published_at: string;
      modified_by: string;
      created_by: string;
      type: "video-categories";
      metadata: null;
    }[];
    image: null | string;
    video_url: string;
    direct_video: null | string;
    description: null | string;
    featured_on_homepage: boolean;
  };
};

export type TakeoverType = {
  slug: string;
  title: string;
  type: "takeovers";
  metadata: {
    description: string;
    image: {
      url: string;
      imgix_url: string;
    };
  };
};

export type GenreType = {
  slug: string;
  title: string;
  type: "genres";
};

export type LocationType = {
  slug: string;
  title: string;
  type: "locations";
};

export type RegularHostType = {
  slug: string;
  title: string;
  type: "regular-hosts";
  metadata: {
    description: string;
    image: {
      url: string;
      imgix_url: string;
    };
  };
};
