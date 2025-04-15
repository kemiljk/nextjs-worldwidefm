import { createBucketClient } from "@cosmicjs/sdk";

// Initialize Cosmic client
export const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
});

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
    subtitle: string | null;
    image: CosmicImage | null;
    description: string | null;
    featured_on_homepage: boolean;
    player: string | null;
    tracklist: string | null;
    body_text: string | null;
    broadcast_date: string | null;
    broadcast_time: string | null;
    broadcast_day: string | null;
    duration: string | null;
    page_link: string | null;
    source: string | null;
    genres: GenreObject[];
    locations: LocationObject[];
    regular_hosts: HostObject[];
    takeovers: TakeoverObject[];
  };
}

export interface GenreObject {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  published_at: string;
  status: string;
  type: string;
  metadata: {
    description: string | null;
    image: CosmicImage | null;
  } | null;
}

export interface LocationObject {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  published_at: string;
  status: string;
  type: string;
  metadata: {
    description: string | null;
    image: CosmicImage | null;
  } | null;
}

export interface HostObject {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  published_at: string;
  status: string;
  type: string;
  metadata: {
    description: string | null;
    image: CosmicImage | null;
  } | null;
}

export interface TakeoverObject {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  published_at: string;
  status: string;
  type: string;
  metadata: {
    description: string | null;
    image: CosmicImage | null;
  } | null;
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
  type: string;
  created_at: string;
  metadata: {
    type?: {
      key: string;
      value: string;
    };
    categories?: {
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
      type: string;
      metadata: null;
    }[];
    image?: {
      url: string;
      imgix_url: string;
    };
    author?:
      | {
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
          type: string;
          metadata: null;
        }
      | string;
    date?: string;
    excerpt?: string | null;
    description?: string | null;
    content?: string;
    featured_on_homepage?: boolean;
    is_featured?: boolean;
    featured_size?: {
      key: string;
      value: string;
    };
    section_name?: string | null;
    section_priority?: number;
    section?: {
      id: string;
      slug: string;
      title: string;
      content?: string;
      metadata?: {
        priority?: number;
      } | null;
    } | null;
    display_style?: {
      key: string;
      value: string;
    };
    image_aspect_ratio?: {
      key: string;
      value: string;
    };
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

export interface VideoObject {
  id: string;
  slug: string;
  title: string;
  type: "videos";
  metadata: {
    image?: CosmicImage;
    description?: string;
    video_url?: string;
    date?: string;
    categories?: {
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
      type: string;
      metadata: null;
    }[];
  };
}

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
