'use client';

import { Loader2, ChevronRight } from 'lucide-react';
import { ArticleCard } from '@/components/ui/article-card';
import { EventCard } from '@/components/ui/event-card';
import { getPostsWithFilters } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { PostObject } from '@/lib/cosmic-config';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';

import Link from 'next/link';

interface Post extends PostObject {}

interface EditorialSectionProps {
  title: string;
  posts: Post[];
  events?: Array<{
    id: string;
    slug: string;
    title: string;
    metadata: {
      event_date: string;
      location: string;
      description: string;
      ticket_link: string;
      image: {
        url: string;
        imgix_url: string;
      } | null;
    };
  }>;
  className?: string;
  isHomepage?: boolean;
  layout?: 'grid' | 'list';
  // Add filter props for pagination
  currentFilters?: {
    searchTerm?: string;
    categories?: string[];
    postType?: 'article' | 'video';
  };
  availableFilters?: {
    categories: Array<{ id: string; slug: string; title: string }>;
  };
}

export default function EditorialSection({
  title,
  posts,
  events = [],
  className,
  isHomepage = false,
  currentFilters,
  availableFilters,
}: EditorialSectionProps) {
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>(posts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false); // Start with false, only show if we have a full batch
  const [currentOffset, setCurrentOffset] = useState(0);

  // Combine posts and events, sorting by date
  const combinedItems = useMemo(() => {
    const allItems = [
      ...posts.map(post => ({
        type: 'post' as const,
        data: post,
        date: post.metadata?.date,
      })),
      ...events.map(event => ({
        type: 'event' as const,
        data: event,
        date: event.metadata?.event_date,
      })),
    ];
    // Sort by date descending
    return allItems.sort(
      (a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
    );
  }, [posts, events]);

  // Update displayedPosts when posts prop changes
  useEffect(() => {
    setDisplayedPosts(posts);
    // Set initial offset based on posts length
    setCurrentOffset(posts.length);

    // Only show "Load More" if we loaded a full batch (20 posts)
    // This indicates there might be more posts available
    setHasMore(posts.length >= 20);
  }, [posts]);

  async function loadMorePosts() {
    try {
      setIsLoading(true);

      console.log(
        'Loading more posts with offset:',
        currentOffset,
        'current posts:',
        displayedPosts.length
      );

      // Convert category slugs to IDs for the Cosmic query
      const categoryIds =
        (currentFilters?.categories
          ?.map(slug => {
            const category = availableFilters?.categories.find(cat => cat.slug === slug);
            return category?.id;
          })
          .filter(Boolean) as string[]) || [];

      const result = await getPostsWithFilters({
        limit: 20,
        offset: currentOffset,
        searchTerm: currentFilters?.searchTerm || '',
        categories: categoryIds,
        postType: currentFilters?.postType,
      });

      console.log(
        'Received',
        result.posts.length,
        'new posts, total offset will be:',
        currentOffset + result.posts.length
      );

      if (result.posts.length > 0) {
        // Filter out any posts that already exist to prevent duplicates
        const existingIds = new Set(displayedPosts.map(post => post.id));
        const newPosts = result.posts.filter(post => !existingIds.has(post.id));

        console.log(
          'Filtered out',
          result.posts.length - newPosts.length,
          'duplicate posts, adding',
          newPosts.length,
          'new posts'
        );

        if (newPosts.length > 0) {
          setDisplayedPosts(prev => [...prev, ...newPosts]);
          setCurrentOffset(prev => prev + newPosts.length);

          // Only show "Load More" if we received a full batch (20 posts)
          // This indicates there might be more posts available
          setHasMore(newPosts.length >= 20);
        } else {
          // If all posts were duplicates, we've reached the end
          setHasMore(false);
        }
      } else {
        // No more posts available
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className={cn('', className)}>
      {!isHomepage && (
        <div className={`flex items-center justify-between mb-4 mt-4`}>
          <h2 className='text-[40px] tracking-tight font-display uppercase font-normal text-almostblack dark:text-white'>
            {title}
          </h2>
        </div>
      )}
      {isHomepage ? (
        <div className='px-5'>
          <div className='flex w-full justify-between items-end mb-2'>
            <h2 className='text-h8 md:text-h7 font-bold tracking-tight'>{title}</h2>
            <Link
              href='/editorial'
              className='inline-flex items-center font-mono uppercase hover:underline transition-all text-sm'
            >
              See All
              <ChevronRight className='ml-1 h-4 w-4' />
            </Link>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
            {posts.slice(0, 3).map((post: Post) => {
              const tags = (post.metadata?.categories || [])
                .map((cat: any) => {
                  if (typeof cat === 'string') return cat;
                  if (cat && typeof cat === 'object' && typeof (cat as any).title === 'string')
                    return (cat as any).title;
                  return '';
                })
                .filter((tag: string) => !!tag);

              const article = {
                key: post.slug,
                name: post.title,
                url: `/editorial/${post.slug}`,
                slug: post.slug,
                pictures: {
                  large:
                    post.thumbnail?.imgix_url ||
                    post.metadata?.image?.imgix_url ||
                    '/image-placeholder.png',
                },
                created_time: post.metadata?.date || '',
                tags,
                categories: post.metadata?.categories || [],
                excerpt: post.metadata?.excerpt || '',
              };

              return (
                <ArticleCard
                  key={post.id}
                  title={article.name}
                  slug={article.slug}
                  image={article.pictures.large}
                  excerpt={article.excerpt}
                  date={article.created_time}
                  tags={tags}
                  categories={article.categories}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-10'>
            {combinedItems.map((item, index) => {
              if (item.type === 'event') {
                const event = item.data;
                return (
                  <EventCard
                    key={`event-${event.id}`}
                    title={event.title}
                    slug={event.slug}
                    image={event.metadata?.image?.imgix_url || '/image-placeholder.png'}
                    eventDate={event.metadata.event_date}
                    location={event.metadata.location}
                    ticketLink={event.metadata.ticket_link}
                    description={event.metadata.description}
                  />
                );
              } else {
                const post = item.data;
                const tags = (post.metadata?.categories || [])
                  .map((cat: any) => {
                    if (typeof cat === 'string') return cat;
                    if (cat && typeof cat === 'object' && typeof (cat as any).title === 'string')
                      return (cat as any).title;
                    return '';
                  })
                  .filter((tag: string) => !!tag);

                return (
                  <ArticleCard
                    key={`post-${post.id}`}
                    title={post.title}
                    slug={post.slug}
                    image={
                      post.thumbnail?.imgix_url ||
                      post.metadata?.image?.imgix_url ||
                      '/image-placeholder.png'
                    }
                    date={post.metadata?.date || ''}
                    tags={tags}
                    categories={post.metadata?.categories || []}
                  />
                );
              }
            })}
          </div>
          {/* Load More Button */}
          {hasMore && (
            <div className='w-full flex items-center justify-center mt-8'>
              <Button
                onClick={loadMorePosts}
                disabled={isLoading}
                variant='outline'
                className='border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
