import { createBucketClient } from '@cosmicjs/sdk';

export const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
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
    external_image_url?: string | null;
    description: string | null;
    featured_on_homepage: boolean;
    player: string | null;
    tracklist: string | null;
    body_text: string | null;
    broadcast_date: string | null;
    broadcast_date_old?: string | null;
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
  created_at: string;
  modified_at: string;
  published_at: string;
  status: string;
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
    external_image_url?: string | null;
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
    external_image_url?: string | null;
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
    external_image_url?: string | null;
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
    external_image_url?: string | null;
  } | null;
}

export interface ShowTypeObject {
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
    external_image_url?: string | null;
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
  type: 'authors';
  metadata: any;
}

export interface PostObject {
  id: string;
  slug: string;
  title: string;
  type: string;
  created_at: string;
  status?: string;
  thumbnail?: {
    url: string;
    imgix_url: string;
  };
  metadata: {
    seo?: {
      title?: string;
      description?: string;
      og_title?: string;
      og_description?: string;
      og_image?: {
        url: string;
        imgix_url: string;
      };
    };
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
    content?: string;
    is_featured?: boolean;
    text_focus?: boolean;
    featured_size?: {
      key: string;
      value: string;
    };
    image_aspect_ratio?: {
      key: string;
      value: string;
    };
    image_gallery?: {
      image: {
        url: string;
        imgix_url: string;
      };
    }[];
    gallery_layout?: {
      key: string;
      value: string;
    };
    tags?: string[];
    youtube_video?: string;
    youtube_video_thumbnail?: {
      url: string;
      imgix_url: string;
    };
    video?: {
      url: string;
      imgix_url: string;
    };
    video_thumbnail?: {
      url: string;
      imgix_url: string;
    };
    external_image_url?: string | null;
    featured_link?: string;
    display_order?: number;
  };
}

export interface EditorialHomepageObject {
  slug: string;
  title: string;
  type: 'editorial-homepage';
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
  type: 'videos';
  created_at: string;
  metadata: {
    image?: CosmicImage;
    external_image_url?: string | null;
    description?: string;
    video_url?: string;
    direct_video?: CosmicImage;
    date?: string;
    featured_on_homepage?: boolean;
    is_featured?: boolean;
    featured_size?: {
      key: string;
      value: string;
    };
    image_aspect_ratio?: {
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
    display_order?: number;
  };
}

export interface AboutObject {
  id: string;
  slug: string;
  title: string;
  type: 'about';
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
