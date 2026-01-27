'use client';

import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 border border-almostblack dark:border-white/20 text-center bg-stone-50/5 dark:bg-white/5',
        className
      )}
    >
      <div className='mb-4 p-3 border border-almostblack dark:border-white/20'>
        <Icon className='size-6 text-almostblack dark:text-white' />
      </div>
      <h3 className='font-mono text-m6 uppercase mb-2 text-almostblack dark:text-white'>
        {title}
      </h3>
      <p className='text-m8 text-gray-500 dark:text-gray-400 mb-6 max-w-xs'>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          variant='outline'
          onClick={onAction}
          className='uppercase font-mono text-m8 border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack transition-colors rounded-none'
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
