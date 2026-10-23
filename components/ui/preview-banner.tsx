'use client';

import { cn } from '@/lib/utils';

interface PreviewBannerProps {
  className?: string;
}

export function PreviewBanner({ className }: PreviewBannerProps) {
  return (
    <div
      className={cn(
        'w-full bg-yellow-400 text-black border-b-2 border-black mt-3',
        'flex items-center justify-center py-2 px-4 text-center',
        'font-mono text-sm font-bold uppercase tracking-wider',
        className
      )}
    >
      <div className='flex flex-col items-center gap-1'>
        <div className='flex items-center gap-2'>
          <span className='animate-pulse'>●</span>
          <span>Preview Mode - Viewing Draft Content</span>
          <span className='animate-pulse'>●</span>
        </div>
        <span className='font-normal normal-case tracking-normal'>
          Share this page&apos;s address to let others review this draft before it&apos;s published.
        </span>
      </div>
    </div>
  );
}
