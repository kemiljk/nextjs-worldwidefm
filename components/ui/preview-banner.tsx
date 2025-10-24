'use client';

import { cn } from '@/lib/utils';

interface PreviewBannerProps {
  className?: string;
}

export function PreviewBanner({ className }: PreviewBannerProps) {
  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-black border-b-2 border-black',
        'flex items-center justify-center py-2 px-4 text-center',
        'font-mono text-sm font-bold uppercase tracking-wider',
        className
      )}
    >
      <div className='flex items-center gap-2'>
        <span className='animate-pulse'>●</span>
        <span>Preview Mode - Viewing Draft Content</span>
        <span className='animate-pulse'>●</span>
      </div>
    </div>
  );
}
