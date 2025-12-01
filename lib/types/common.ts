/**
 * Common type utilities to replace 'any' usage
 *
 * These types help improve type safety throughout the codebase
 * by providing specific types for common patterns.
 */

import type {
  GenreObject,
  HostObject,
  LocationObject,
  TakeoverObject,
} from '../cosmic-config';

/**
 * Type for Cosmic query objects
 */
export type CosmicQuery = {
  type?: string;
  status?: string;
  [key: string]: unknown;
};

/**
 * Union type for all Cosmic object types that appear in metadata arrays
 */
export type CosmicMetadataObject = GenreObject | HostObject | LocationObject | TakeoverObject;

/**
 * Type guard to check if an object is a GenreObject
 */
export function isGenreObject(obj: unknown): obj is GenreObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'genres'
  );
}

/**
 * Type guard to check if an object is a HostObject
 */
export function isHostObject(obj: unknown): obj is HostObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'regular-hosts'
  );
}

/**
 * Type guard to check if an object is a LocationObject
 */
export function isLocationObject(obj: unknown): obj is LocationObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'locations'
  );
}

/**
 * Type guard to check if an object is a TakeoverObject
 */
export function isTakeoverObject(obj: unknown): obj is TakeoverObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: string }).type === 'takeovers'
  );
}

/**
 * Type for objects with metadata arrays
 */
export interface HasMetadata {
  metadata?: {
    genres?: GenreObject[];
    regular_hosts?: HostObject[];
    locations?: LocationObject[];
    takeovers?: TakeoverObject[];
    [key: string]: unknown;
  };
}

/**
 * Type for Cosmic API response objects (with type narrowing)
 */
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
