import { CosmicImage, GenreObject, LocationObject, HostObject, TakeoverObject } from "./cosmic-config";

export interface CosmicObjectMeta {
  [key: string]: any;
  subtitle: null;
  featured_on_homepage: boolean;
  image: Image;
  tags: any[];
  genres: Genre[];
  locations: Location[];
  regular_hosts: RegularHost[];
  takeovers: any[];
  description: null;
  page_link: null;
  source: null;
  broadcast_date: string;
  broadcast_time: string;
  duration: string;
  player: null;
  tracklist: null;
  body_text: null;
  radiocult_media_id: null;
  media_file: null;
}

interface Genre {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  status: string;
  published_at: string;
  type: string;
  metadata: null;
}

interface Image {
  url: string;
  imgix_url: string;
}

interface Location {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  status: string;
  published_at: string;
  type: string;
  metadata: {
    description: null;
    image: null;
  };
}

interface RegularHost {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  status: string;
  published_at: string;
  type: string;
  metadata: {
    description: string | null;
    image: Image;
  };
}

export interface CosmicItem {
  slug: string;
  title: string;
  type: string; // e.g., "episodes", "posts"
  metadata: CosmicObjectMeta;
}

export interface HomepageHeroItem extends CosmicItem {
  // Specific properties for hero items if any, otherwise defaults to CosmicItem
}

export interface HomepageSection {
  is_active: boolean;
  title: string;
  type: string; // e.g., "Shows", "Editorial", "Custom", "regular-hosts", "new-voices", "friday-curates"
  layout: "Grid" | "Unique"; // Only Grid and Unique layouts supported
  itemsPerRow: number;
  items: string[];
  color?: string; // Optional color for the section background
  subtitle?: string; // Optional subtitle for unique sections
  description?: string; // Optional description for unique sections
}

export interface ColouredSection {
  title: string;
  time: string;
  description: string;
  show_type: string[]; // Array of show type IDs
}

export interface HomepageSectionItem extends CosmicItem {
  // Specific properties for section items if any, otherwise defaults to CosmicItem
}

export interface ProcessedHomepageSection extends Omit<HomepageSection, "items" | "layout"> {
  items: HomepageSectionItem[];
  layout: "Grid" | "Unique"; // Only Grid and Unique layouts supported
}

export interface CosmicHomepageData {
  slug: "homepage";
  title: "Homepage";
  type: "homepage";
  metadata: {
    heroLayout: "Split" | "FullWidth" | "Full Width" | "Carousel" | string; // Added "Full Width" with a space
    heroItems: HomepageHeroItem[];
    sections: HomepageSection[];
    coloured_sections?: ColouredSection[]; // Optional coloured sections
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

export interface AboutObject {
  id: string;
  slug: string;
  title: string;
  type: "about";
  metadata: {
    hero_image: CosmicImage;
    hero_title: string;
    hero_subtitle: string;
    mission_title: string;
    mission_content: string;
    story_title: string;
    story_image: CosmicImage;
    timeline: {
      year: string;
      title: string;
      content: string;
    }[];
    connect_title: string;
    connect_content: string;
    social_links: {
      instagram?: string;
      twitter?: string;
      facebook?: string;
    };
    contact_info: {
      email: string;
      phone: string;
      location: string;
    };
  };
}

export interface EpisodeObject {
  id: string;
  slug: string;
  title: string;
  type: "episode";
  metadata: {
    radiocult_event_id: string | null;
    radiocult_show_id: string | null;
    radiocult_artist_id: string | null;
    radiocult_synced: boolean;
    radiocult_synced_at: string | null;
    broadcast_date: string | null;
    broadcast_time: string | null;
    duration: string | null;
    description: string | null;
    image: CosmicImage | null;
    player: string | null;
    tracklist: string | null;
    body_text: string | null;
    genres: GenreObject[];
    locations: LocationObject[];
    regular_hosts: HostObject[];
    takeovers: TakeoverObject[];
    featured_on_homepage: boolean;
    source: string | null;
  };
  created_at: string;
  modified_at: string;
  published_at: string;
  status: string;
}
