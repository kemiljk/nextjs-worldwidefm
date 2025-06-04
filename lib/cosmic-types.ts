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
