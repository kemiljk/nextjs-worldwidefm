export const COSMIC_CONFIG = {
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "",
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || "",
};

// Types based on the provided API responses
export interface CosmicImage {
  url: string;
  imgix_url: string;
}

export interface CategoryObject {
  slug: string;
  title: string;
  type: string;
  metadata: Record<string, any> | null;
}

export interface RadioShowObject {
  id: string;
  slug: string;
  title: string;
  type: string;
  metadata: {
    subtitle: string;
    image: CosmicImage;
    description: string;
    player: string;
    tracklist: string | null;
    body_text: string | null;
    broadcast_date: string | null;
    broadcast_time: string | null;
    broadcast_day: string | null;
    duration: string | null;
    categories: string[];
  };
}

export interface ScheduleObject {
  slug: string;
  title: string;
  type: string;
  metadata: {
    shows: RadioShowObject[];
    scheduled_shows: RadioShowObject[];
    is_active: boolean;
    special_scheduling_options: {
      override_normal_schedule: boolean;
      override_reason: string | null;
      special_insertions: RadioShowObject[];
    };
    schedule_notes: string | null;
  };
}

export interface CosmicResponse<T> {
  objects?: T[];
  object?: T;
  total?: number;
}

export interface AuthorObject {
  id: string;
  slug: string;
  title: string;
  type: "authors";
  metadata: any;
}

export interface PostObject {
  id: string;
  slug: string;
  title: string;
  type: "posts";
  metadata: {
    image: {
      url: string;
      imgix_url: string;
    };
    description: string;
    date: string;
    content: string | null;
    post_type: "article" | "video" | "event";
    featured_on_homepage: boolean;
    author?: AuthorObject;
    link?: string;
  };
}

export interface EditorialHomepageObject {
  slug: string;
  title: string;
  type: "editorial-homepage";
  metadata: {
    featured_posts: PostObject[];
    hero_section?: {
      headline: string;
      subheading: string;
      hero_image: any;
    };
    show_trending_section?: boolean;
  };
}
