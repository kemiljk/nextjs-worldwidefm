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
    page_link: string | null;
    source: string | null;
    broadcast_date: string | null;
    broadcast_time: string | null;
    duration: string | null;
    categories: string[];
  };
}

export interface ScheduleObject {
  slug: string;
  title: string;
  type: string;
  metadata: {
    shows: any[];
    scheduled_shows: any[];
    is_active: boolean;
    special_scheduling_options: {
      override_normal_schedule: boolean;
      override_reason: string | null;
      special_insertions: any[];
    };
    schedule_notes: string | null;
  };
}

export interface CosmicResponse<T> {
  objects?: T[];
  object?: T;
  total?: number;
}
