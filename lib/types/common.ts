import type { GenreObject, HostObject, LocationObject, TakeoverObject } from '../cosmic-config';

export type CosmicQuery = {
  type?: string;
  status?: string;
  [key: string]: unknown;
};

export type CosmicMetadataObject = GenreObject | HostObject | LocationObject | TakeoverObject;

export function isGenreObject(obj: unknown): obj is GenreObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'genres'
  );
}

export function isHostObject(obj: unknown): obj is HostObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'regular-hosts'
  );
}

export function isLocationObject(obj: unknown): obj is LocationObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'locations'
  );
}

export function isTakeoverObject(obj: unknown): obj is TakeoverObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'takeovers'
  );
}

export interface HasMetadata {
  metadata?: {
    genres?: GenreObject[];
    regular_hosts?: HostObject[];
    locations?: LocationObject[];
    takeovers?: TakeoverObject[];
    [key: string]: unknown;
  };
}

export type CosmicResponseObject<T = unknown> = {
  id: string;
  slug: string;
  title: string;
  type: string;
  metadata?: T;
  created_at?: string;
  modified_at?: string;
  published_at?: string;
  status?: string;
};
