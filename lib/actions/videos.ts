'use server';

import { VideoObject } from '../cosmic-config';
import { cosmic } from '../cosmic-config';

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
    const filters: any = {
      type: 'videos',
      limit,
      skip: offset,
      sort: '-metadata.date',
      status: 'published',
      props: 'id,slug,title,metadata,created_at',
      depth: 3,
    };
    if (tag) {
      filters['metadata.categories'] = tag;
    }
    if (searchTerm) {
      filters['title'] = searchTerm;
    }
    const response = await cosmic.objects.find(filters);
    const videos = response.objects || [];
    const hasNext = videos.length === limit;
    return { videos, hasNext };
  } catch (error) {
    console.error('Error in getVideos:', error);
    return { videos: [], hasNext: false };
  }
}

export async function getVideoCategories(): Promise<any[]> {
  try {
    const response = await cosmic.objects.find({
      type: 'video-categories',
      props:
        'id,slug,title,content,bucket,created_at,modified_at,status,published_at,modified_by,created_by,type,metadata',
      depth: 1,
    });
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
      .depth(3);

    return response?.object || null;
  } catch (error) {
    console.error('Error in getVideoBySlug:', error);
    return null;
  }
}

