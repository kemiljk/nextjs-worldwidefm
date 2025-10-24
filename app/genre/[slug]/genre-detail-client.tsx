'use client';

import React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { ShowsGrid } from '@/components/shows-grid';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { CanonicalGenre } from '@/lib/get-canonical-genres';
import { useRouter, useSearchParams } from 'next/navigation';

type ActiveType = 'all' | 'hosts-series' | 'takeovers';

interface GenreDetailProps {
  genre: CanonicalGenre;
  canonicalGenres: CanonicalGenre[];
  shows: any[];
  hasNext: boolean;
  activeType: ActiveType;
  currentPage: number;
}

export default function GenreDetail({
  genre,
  canonicalGenres,
  shows,
  hasNext,
  activeType,
  currentPage,
}: GenreDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const PAGE_SIZE = 20;

  const setType = (type: ActiveType) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (type === 'all') params.delete('type');
    else params.set('type', type);
    params.set('page', '1');
    router.push(`/genre/${genre.slug}?${params.toString()}`);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    router.push(`/genre/${genre.slug}?${params.toString()}`);
  };

  return (
    <div className='w-full overflow-x-hidden'>
      <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
        {/* Hyperpop background */}
        <div className='absolute inset-0 bg-hyperpop' />

        {/* Linear white gradient */}
        <div
          className='absolute inset-0 bg-gradient-to-b from-white via-white/0 to-white'
          style={{ mixBlendMode: 'hue' }}
        />

        {/* Noise Overlay */}
        <div
          className='absolute inset-0'
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
            mixBlendMode: 'screen',
          }}
        />
        <div className='absolute bottom-0 left-0 w-full px-5 z-10'>
          <PageHeader title={genre.title.toUpperCase()} />
        </div>
      </div>

      <div className='px-5 flex flex-col gap-1 w-full'>
        {/* Filter Controls */}
        <div className='flex flex-wrap gap-2 text-m7 pt-4 pb-2'>
          {/* Type Navigation Buttons */}
          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeType === 'all' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={() => setType('all')}
          >
            Episodes
          </Button>

          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeType === 'hosts-series' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={() => setType('hosts-series')}
          >
            Hosts & Series
          </Button>

          <Button
            variant='outline'
            className={cn(
              'border-almostblack dark:border-white',
              activeType === 'takeovers' &&
                'bg-almostblack text-white dark:bg-white dark:text-almostblack'
            )}
            onClick={() => setType('takeovers')}
          >
            Takeovers
          </Button>
        </div>
      </div>

      <div className='pt-2 w-full px-5 flex-col pb-20'>
        <main className=''>
          {shows.length > 0 ? (
            <ShowsGrid
              shows={shows}
              contentType={activeType as 'episodes' | 'hosts-series' | 'takeovers'}
              canonicalGenres={canonicalGenres}
            />
          ) : (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <div className='text-6xl mb-4'>🔍</div>
              <h3 className='text-xl font-semibold mb-2'>No results found</h3>
              <p className='text-gray-600 mb-6 max-w-md'>
                No{' '}
                {activeType === 'hosts-series'
                  ? 'hosts'
                  : activeType === 'takeovers'
                    ? 'takeovers'
                    : 'episodes'}{' '}
                found for the {genre.title} genre.
              </p>
              <div className='flex gap-3'>
                <Link href='/shows'>
                  <Button
                    variant='outline'
                    className='border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack'
                  >
                    <ArrowLeft className='h-4 w-4 mr-2' />
                    Back to All Shows
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </main>

        {/* Pagination */}
        {(currentPage > 1 || hasNext) && (
          <div className='w-full flex items-center justify-center gap-3 mt-8'>
            {currentPage > 1 && (
              <Button
                onClick={() => goToPage(currentPage - 1)}
                variant='outline'
                className='border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack'
              >
                Previous
              </Button>
            )}
            {hasNext && (
              <Button
                onClick={() => goToPage(currentPage + 1)}
                variant='outline'
                className='border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack'
              >
                Next
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
