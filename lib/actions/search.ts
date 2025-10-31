'use server';

import {
  SearchResult,
  PostSearchResult,
  EpisodeSearchResult,
  FilterItem,
} from '../search/unified-types';
import { PostObject } from '../cosmic-config';
import { getAllPosts } from './posts';
import { getAllShows } from './shows';

export async function getAllSearchableContent(limit?: number): Promise<SearchResult[]> {
  try {
    const showsLimit = limit ?? 1000;
    const [postsResponse, showsResponse] = await Promise.all([
      getAllPosts(),
      getAllShows(0, showsLimit),
    ]);

    const normalizeFilterItems = (items: any[] = []): FilterItem[] => {
      return items
        .filter(Boolean)
        .map((item: { title?: string; slug?: string; id?: string; type?: string }) => ({
          title: item.title || '',
          slug: item.slug || item.id || '',
          type: item.type || '',
        }));
    };

    const allContent: SearchResult[] = [
      ...postsResponse.posts.map((post: PostObject): PostSearchResult => {
        const categories = post.metadata?.categories || [];

        return {
          id: post.id,
          title: post.title,
          slug: post.slug,
          type: 'posts',
          description: post.metadata?.content || '',
          excerpt: post.metadata?.excerpt || '',
          image: post.metadata?.image?.imgix_url || '/image-placeholder.png',
          date: post.metadata?.date || '',
          categories: normalizeFilterItems(categories),
          author:
            typeof post.metadata?.author === 'string'
              ? post.metadata.author
              : post.metadata?.author?.title,
          postType: post.metadata?.type?.key as 'article' | 'video' | 'event',
          featured: post.metadata?.is_featured,
          metadata: post.metadata,
        };
      }),
      ...showsResponse.shows.map(
        (show): EpisodeSearchResult => ({
          id: show.id,
          title: show.title,
          slug: show.slug,
          type: 'episodes',
          description: show.metadata?.description || '',
          excerpt: show.metadata?.subtitle || '',
          image: show.metadata?.image?.imgix_url || '/image-placeholder.png',
          date: show.metadata?.broadcast_date || '',
          genres: normalizeFilterItems(show.metadata?.genres || []),
          locations: normalizeFilterItems(show.metadata?.locations || []),
          hosts: normalizeFilterItems(show.metadata?.regular_hosts || []),
          takeovers: normalizeFilterItems(show.metadata?.takeovers || []),
          duration: show.metadata?.duration,
          broadcastTime: show.metadata?.broadcast_time,
          featured: show.metadata?.featured_on_homepage,
          metadata: show.metadata,
        })
      ),
    ].sort((a, b) => {
      const dateA = new Date(a.date || '');
      const dateB = new Date(b.date || '');
      return dateB.getTime() - dateA.getTime();
    });

    return allContent;
  } catch (error) {
    console.error('Error in getAllSearchableContent:', error);
    return [];
  }
}

export async function searchContent(
  query?: string,
  source?: string,
  limit: number = 100
): Promise<SearchResult[]> {
  try {
    const safeString = (val: any): string | undefined =>
      typeof val === 'string' && val.trim() ? val : undefined;
    const getImage = (meta: any): string | undefined =>
      meta?.image?.imgix_url || meta?.image?.url || undefined;
    const getGenres = (meta: any): FilterItem[] =>
      (meta?.categories || [])
        .filter(Boolean)
        .map((cat: any) => ({ slug: cat.slug, title: cat.title, type: 'genres' }));
    const getDate = (meta: any, fallback: string): string | undefined =>
      safeString(meta?.date) || fallback;

    const { cosmic } = await import('../cosmic-config');
    const [episodesResponse, postsResponse, eventsResponse, videosResponse, takeoversResponse] =
      await Promise.all([
        import('../episode-service').then(m => m.getEpisodesForShows({ searchTerm: query, limit })),
        cosmic.objects.find({
          type: 'posts',
          ...(query && { q: query }),
          props: 'id,title,slug,metadata,created_at',
          limit,
          status: 'published',
        }),
        cosmic.objects.find({
          type: 'events',
          ...(query && { q: query }),
          props: 'id,title,slug,metadata,created_at',
          limit,
          status: 'published',
        }),
        cosmic.objects.find({
          type: 'videos',
          ...(query && { q: query }),
          props: 'id,title,slug,metadata,created_at',
          limit,
          status: 'published',
        }),
        cosmic.objects.find({
          type: 'takeovers',
          ...(query && { q: query }),
          props: 'id,title,slug,metadata,created_at',
          limit,
          status: 'published',
        }),
      ]);
    const episodes = episodesResponse.shows || [];
    const posts = postsResponse.objects || [];
    const events = eventsResponse.objects || [];
    const videos = videosResponse.objects || [];
    const takeovers = takeoversResponse.objects || [];
    const results = [
      ...episodes.map((item: any) => ({
        id: item.id || item.slug,
        title: item.title || item.name || '',
        slug: item.slug || '',
        type: 'episodes' as const,
        description: item.metadata?.description || '',
        image: getImage(item.metadata || item),
        date: item.metadata?.broadcast_date || item.created_at || '',
        genres: getGenres(item.metadata || {}),
      })),
      ...posts
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          type: 'posts' as const,
          description: item.metadata?.content || '',
          excerpt: item.metadata?.excerpt || '',
          image: getImage(item.metadata),
          date: getDate(item.metadata, item.created_at),
          categories: getGenres(item.metadata || {}),
        }))
        .filter((item: any) => item.title),
    ];

    return results;
  } catch (error) {
    console.error('Error in searchContent:', error);
    return [];
  }
}
