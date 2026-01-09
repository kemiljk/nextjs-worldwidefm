'use server';

import { VideoObject } from '../cosmic-config';
import { cosmic } from '../cosmic-config';

/**
 * Fetch for videos
 */
async function fetchVideosFromCosmic(
  query: Record<string, unknown>,
  limit: number,
  offset: number
): Promise<VideoObject[]> {
  const response = await cosmic.objects
    .find(query)
    .props('id,slug,title,metadata,created_at')
    .limit(limit)
    .skip(offset)
    .sort('-metadata.date')
    .depth(2);

  return response.objects || [];
}

export async function getVideos({
  limit = 20,
  offset = 0,
  tag,
  searchTerm,
}: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{
  videos: VideoObject[];
  hasNext: boolean;
}> {
  try {
    const query: Record<string, unknown> = {
      type: 'videos',
      status: 'published',
    };

    if (tag) {
      query['metadata.categories'] = tag;
    }
    if (searchTerm) {
      query['title'] = searchTerm;
    }

    const videos = await fetchVideosFromCosmic(query, limit, offset);
    const hasNext = videos.length === limit;
    return { videos, hasNext };
  } catch (error) {
    console.error('Error in getVideos:', error);
    return { videos: [], hasNext: false };
  }
}

export async function getVideoCategories(): Promise<unknown[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'video-categories',
      })
      .props('id,slug,title,metadata')
      .depth(1);

    return response.objects || [];
  } catch (error) {
    console.error('Error in getVideoCategories:', error);
    return [];
  }
}

export async function getVideoBySlug(slug: string): Promise<VideoObject | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'videos',
        slug: slug,
        status: 'published',
      })
      .props('id,slug,title,metadata,created_at')
      .depth(2);

    return response?.object || null;
  } catch (error) {
    console.error('Error in getVideoBySlug:', error);
    return null;
  }
}
