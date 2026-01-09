'use server';

import { getPosts, getEditorialHomepage } from '../cosmic-service';
import { PostObject } from '../cosmic-config';
import { cosmic } from '../cosmic-config';

/**
 * Fetch for posts with filters
 */
async function fetchPostsWithFiltersFromCosmic(
  query: Record<string, unknown>,
  limit: number,
  offset: number
): Promise<{ objects: PostObject[]; total: number }> {
  const response = await cosmic.objects
    .find(query)
    .limit(limit)
    .skip(offset)
    .sort('-metadata.date')
    .depth(2);

  return {
    objects: response.objects || [],
    total: response.total || 0,
  };
}

export async function getPostsWithFilters({
  limit = 20,
  offset = 0,
  searchTerm,
  categories,
  postType,
  featured,
}: {
  limit?: number;
  offset?: number;
  searchTerm?: string;
  categories?: string[];
  postType?: 'article' | 'video';
  featured?: boolean;
} = {}): Promise<{
  posts: PostObject[];
  hasNext: boolean;
  total: number;
}> {
  try {
    const query: Record<string, unknown> = {
      type: 'posts',
      status: 'published',
    };

    if (searchTerm && searchTerm.trim()) {
      const searchRegex = { $regex: searchTerm.trim(), $options: 'i' };
      query.$or = [
        { title: searchRegex },
        { 'metadata.excerpt': searchRegex },
        { 'metadata.description': searchRegex },
      ];
    }

    if (categories && categories.length > 0) {
      query['metadata.categories.id'] = { $in: categories };
    }

    if (postType) {
      const typeValue =
        postType === 'article' ? 'Article' : postType === 'video' ? 'Video' : postType;
      query['metadata.type.value'] = { $eq: typeValue };
    }

    if (featured !== undefined) {
      query['metadata.is_featured'] = featured;
    }

    const { objects: posts, total } = await fetchPostsWithFiltersFromCosmic(query, limit, offset);
    const hasNext = posts.length === limit && offset + limit < total;

    return { posts, hasNext, total };
  } catch (error) {
    console.error('Error in getPostsWithFilters:', error);
    return { posts: [], hasNext: false, total: 0 };
  }
}

export async function getAllPosts({
  limit = 20,
  offset = 0,
  tag,
  searchTerm,
}: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{
  posts: PostObject[];
  hasNext: boolean;
}> {
  try {
    const filters: Record<string, unknown> = {
      limit,
      skip: offset,
      sort: '-metadata.date',
      status: 'published',
    };
    if (tag) {
      filters['metadata.categories'] = tag;
    }
    if (searchTerm) {
      filters['title'] = searchTerm;
    }
    const response = await getPosts(filters);
    const posts = response.objects || [];
    const hasNext = posts.length === limit;
    return { posts, hasNext };
  } catch (error) {
    if (process.env.NODE_ENV === 'development' && error instanceof Error && error.message) {
      console.debug('getAllPosts: No posts found or error occurred:', error.message);
    }
    return { posts: [], hasNext: false };
  }
}

/**
 * Fetch for single post by slug
 */
async function fetchPostBySlugFromCosmic(slug: string): Promise<{ object: PostObject } | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'posts',
        slug: slug,
      })
      .depth(2)
      .status('any');

    return response || null;
  } catch (error) {
    console.error('Error fetching post by slug:', error);
    return null;
  }
}

export async function getPostBySlug(slug: string): Promise<{ object: PostObject } | null> {
  return fetchPostBySlugFromCosmic(slug);
}

export async function getRelatedPosts(post: PostObject): Promise<PostObject[]> {
  try {
    if (!post?.metadata) {
      console.log('No metadata found for post:', post.slug);
      return [];
    }

    let searchTerms: string[] = [];
    let searchField = '';

    if (post.metadata.tags && Array.isArray(post.metadata.tags) && post.metadata.tags.length > 0) {
      searchTerms = post.metadata.tags.filter(tag => typeof tag === 'string' && tag.trim() !== '');
      searchField = 'metadata.tags';
    } else if (post.metadata.categories && Array.isArray(post.metadata.categories)) {
      searchTerms = post.metadata.categories
        .map(cat => {
          if (typeof cat === 'string') {
            return cat;
          }
          if (cat && typeof cat === 'object') {
            if ('slug' in cat && typeof cat.slug === 'string') {
              return cat.slug;
            }
            if ('title' in cat && typeof cat.title === 'string') {
              return cat.title;
            }
            if ('id' in cat && typeof cat.id === 'string') {
              return cat.id;
            }
          }
          return null;
        })
        .filter(
          (term): term is string => term !== null && term !== undefined && term.trim() !== ''
        );
      searchField = 'metadata.categories.slug';
    }

    if (searchTerms.length === 0) {
      return [];
    }

    const query: Record<string, unknown> = {
      type: 'posts',
      status: 'published',
    };

    if (searchField === 'metadata.tags') {
      query['metadata.tags'] = { $in: searchTerms };
    } else {
      query['metadata.categories.slug'] = { $in: searchTerms };
    }

    const relatedPosts = await cosmic.objects.find(query).limit(5).depth(2);

    const filteredPosts = (relatedPosts.objects || [])
      .filter((relatedPost: PostObject) => relatedPost.slug !== post.slug)
      .map((p: { object?: PostObject } | PostObject) =>
        'object' in p && p.object ? p.object : (p as PostObject)
      )
      .slice(0, 3);

    return filteredPosts;
  } catch (error) {
    console.error('Error fetching related posts:', {
      error: error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      postSlug: post?.slug,
      postTags: post?.metadata?.tags,
      postCategories: post?.metadata?.categories,
    });
    return [];
  }
}

export async function getPostCategories(): Promise<unknown[]> {
  try {
    const response = await cosmic.objects.find({
      type: 'categories',
      status: 'published',
    });

    return response.objects || [];
  } catch (error) {
    console.error('Error fetching post categories:', error);
    return [];
  }
}

export async function getEditorialContent(): Promise<{
  posts: PostObject[];
  featuredPosts: PostObject[];
}> {
  try {
    let posts: PostObject[] = [];
    let featuredPosts: PostObject[] = [];

    try {
      const editorialResponse = (await getEditorialHomepage()) as {
        object?: { metadata?: { featured_posts?: PostObject[] } };
      };
      if (editorialResponse?.object?.metadata?.featured_posts) {
        posts = editorialResponse.object.metadata.featured_posts;
        featuredPosts = posts.slice(0, 3);
      }
    } catch {
      console.log('No editorial homepage found, fetching posts directly');
    }

    if (posts.length < 6) {
      const postsResponse = await getPosts({
        limit: 6 - posts.length,
        sort: '-metadata.date',
        status: 'published',
      });

      if (postsResponse.objects && postsResponse.objects.length > 0) {
        posts = [...posts, ...postsResponse.objects];
      }
    }

    if (posts.length === 0) {
      const allPostsResponse = await getPosts({
        limit: 6,
        sort: '-metadata.date',
        status: 'published',
      });

      if (allPostsResponse.objects && allPostsResponse.objects.length > 0) {
        posts = allPostsResponse.objects;
        featuredPosts = posts.slice(0, 3);
      }
    }

    posts.sort((a, b) => {
      const dateA = a.metadata?.date ? new Date(a.metadata.date).getTime() : 0;
      const dateB = b.metadata?.date ? new Date(b.metadata.date).getTime() : 0;
      return dateB - dateA;
    });

    return {
      posts,
      featuredPosts,
    };
  } catch (error) {
    console.error('Error in getEditorialContent:', error);
    return {
      posts: [],
      featuredPosts: [],
    };
  }
}
