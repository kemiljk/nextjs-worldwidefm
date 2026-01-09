'use client';

import React, { useState } from 'react';
import { ShowCard } from '@/components/ui/show-card';
import { Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HostClientProps {
  hostId: string;
  hostTitle: string;
  initialShows: any[];
}

export default function HostClient({ hostId, hostTitle, initialShows }: HostClientProps) {
  const [shows, setShows] = useState(initialShows);
  const [hasNext, setHasNext] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Load more episodes function
  const loadMore = async () => {
    if (!hasNext || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextOffset = page * PAGE_SIZE;

    try {
      const response = await fetch(
        `/api/hosts/${hostId}/episodes?offset=${nextOffset}&limit=${PAGE_SIZE}`
      );
      const data = await response.json();

      if (data.shows && data.shows.length > 0) {
        setShows(prev => [...prev, ...data.shows]);
        setHasNext(data.hasNext);
        setPage(prev => prev + 1);
      } else {
        setHasNext(false);
      }
    } catch (error) {
      console.error('Error loading more episodes:', error);
      setHasNext(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (shows.length === 0) {
    return (
      <div className='text-center py-12'>
        <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white mb-2'>
          No Shows Found
        </h3>
        <p className='text-muted-foreground'>This host doesn't have any shows yet.</p>
      </div>
    );
  }

  return (
    <section className='space-y-3'>
      <h2 className='text-h8 md:text-h7 font-bold tracking-tight leading-none'>EPISODES</h2>
      <div className='grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3 gap-3'>
        {shows.map((show, index) => (
          <ShowCard
            key={`${show.id || show.slug}-${index}`}
            show={show}
            slug={`/episode/${show.slug}`}
            playable
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasNext && (
        <div className='w-full flex items-center justify-center mt-8'>
          <Button
            onClick={loadMore}
            disabled={isLoadingMore}
            variant='outline'
            className='border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack'
          >
            {isLoadingMore ? (
              <>
                <Loader className='h-4 w-4 animate-spin mr-2' />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
