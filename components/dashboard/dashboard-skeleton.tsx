import { Music, Users, Bookmark, Sparkles, Crown } from 'lucide-react';

export function DashboardSkeleton() {
  return (
    <div className='py-8'>
      <div className='mx-auto px-4 flex flex-col gap-8'>
        {/* Header */}
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div className='h-12 w-64 bg-gray-200 dark:bg-gray-800 animate-pulse' />
          <div className='flex gap-2'>
            <div className='h-10 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse' />
            <div className='h-10 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse' />
          </div>
        </div>

        {/* Membership Section Skeleton */}
        <section className='mb-8'>
          <div className='p-6 border border-gray-200 dark:border-gray-800'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
              <div className='flex items-start md:items-center space-x-3'>
                <div className='size-8 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-full' />
                <div className='space-y-2'>
                  <div className='h-6 w-40 bg-gray-200 dark:bg-gray-800 animate-pulse' />
                  <div className='h-4 w-60 bg-gray-200 dark:bg-gray-800 animate-pulse' />
                </div>
              </div>
              <div className='h-10 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse' />
            </div>
          </div>
        </section>

        {/* Favorite Genres Skeleton */}
        <section className='mt-10'>
          <div className='flex items-center justify-between mb-4'>
            <div className='h-8 w-48 bg-gray-200 dark:bg-gray-800 animate-pulse' />
            <div className='h-10 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse' />
          </div>
          <div className='flex flex-wrap gap-2 mb-8'>
            <div className='h-8 w-24 bg-gray-200 dark:bg-gray-800 animate-pulse' />
            <div className='h-8 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse' />
          </div>
          <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4'>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className='aspect-square bg-gray-100 dark:bg-gray-900 animate-pulse' />
            ))}
          </div>
        </section>

        {/* Favorite Hosts Skeleton */}
        <section className='mt-10'>
          <div className='flex items-center justify-between mb-4'>
            <div className='h-8 w-48 bg-gray-200 dark:bg-gray-800 animate-pulse' />
            <div className='h-10 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse' />
          </div>
          <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4'>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className='aspect-square bg-gray-100 dark:bg-gray-900 animate-pulse' />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
