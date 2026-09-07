/** Public content only. Account, member and preview reads must never enter this cache. */
export const CONTENT_TAGS: Record<string, string[]> = {
  episode: ['episodes', 'latest', 'shows', 'schedule', 'homepage'],
  schedule: ['schedule'],
  homepage: ['homepage', 'hero'],
  sections: ['homepage'],
  'coloured-sections': ['homepage'],
  posts: ['posts', 'editorial', 'homepage'],
  'editorial-homepage': ['editorial', 'homepage'],
  'editorial-page-config': ['editorial'],
  videos: ['videos', 'homepage'],
  'videos-page-config': ['videos'],
  'video-categories': ['videos', 'categories'],
  'regular-hosts': ['hosts'],
  takeovers: ['takeovers'],
  genres: ['genres'],
  locations: ['locations'],
  categories: ['categories', 'editorial'],
  navigation: ['navigation'],
  'social-links': ['navigation'],
  about: ['about'],
  membership: ['membership'],
  memberships: ['membership'],
};

export function contentTags(type: string, slug?: string): string[] {
  return [
    ...new Set([
      'public-content',
      ...(CONTENT_TAGS[type] || [type]),
      ...(slug ? [`${type}-${slug}`] : []),
    ]),
  ];
}

/** Every expanded relationship can change independently of the parent object. */
export function changedContentTags(type: string, slug?: string): string[] {
  return [
    ...contentTags(type, slug).filter(tag => tag !== 'public-content'),
    'content-relationships',
  ];
}

export function contentLifetime(type: string) {
  if (type === 'episode' || type === 'schedule') {
    return { stale: 30, revalidate: 60, expire: 3600 };
  }
  if (type === 'homepage' || type === 'sections' || type === 'coloured-sections') {
    return { stale: 60, revalidate: 300, expire: 3600 };
  }
  return { stale: 60, revalidate: 300, expire: 3600 };
}
