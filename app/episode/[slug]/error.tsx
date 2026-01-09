'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function EpisodeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Episode page error:', error);
  }, [error]);

  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh] px-5 text-center'>
      <h1 className='text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-4'>
        Unable to Load Episode
      </h1>
      <p className='text-lg text-muted-foreground mb-6 max-w-md'>
        We had trouble loading this episode. It may have been removed or there might be a temporary
        issue.
      </p>
      <div className='flex gap-4'>
        <button
          onClick={reset}
          className='px-6 py-3 bg-almostblack dark:bg-white text-white dark:text-almostblack font-mono text-sm uppercase tracking-wider hover:opacity-80 transition-opacity'
        >
          Try Again
        </button>
        <Link
          href='/shows'
          className='px-6 py-3 border border-almostblack dark:border-white text-almostblack dark:text-white font-mono text-sm uppercase tracking-wider hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack transition-colors'
        >
          Browse Shows
        </Link>
      </div>
    </div>
  );
}
