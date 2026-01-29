'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import { addListenLater, removeListenLater } from '@/cosmic/blocks/user-management/actions';
import { cn } from '@/lib/utils';

interface SaveShowButtonProps {
  show: { id: string; slug: string; title: string };
  isSaved: boolean;
  className?: string;
  iconOnly?: boolean;
  onSuccess?: (isSaved: boolean) => void;
  onBeforeClick?: (isSaved: boolean) => void;
}

export function SaveShowButton({ 
  show, 
  isSaved: initialIsSaved, 
  className,
  iconOnly = false,
  onSuccess,
  onBeforeClick
}: SaveShowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [isPending, startTransition] = useTransition();

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onBeforeClick) onBeforeClick(isSaved);

    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    // Optimistically update the UI
    const previousIsSaved = isSaved;
    setIsSaved(!isSaved);

    startTransition(async () => {
      let success = false;

      try {
        if (previousIsSaved) {
          const result = await removeListenLater(user.id, show.id);
          success = result.success;
        } else {
          const result = await addListenLater(user.id, { id: show.id });
          success = result.success;
        }

        if (!success) {
          // Revert if the server action failed
          setIsSaved(previousIsSaved);
        } else {
          if (onSuccess) onSuccess(!previousIsSaved);
          router.refresh();
        }
      } catch (error) {
        // Revert on error
        setIsSaved(previousIsSaved);
      }
    });
  };

  if (iconOnly) {
    return (
      <button
        onClick={handleSaveClick}
        disabled={isPending}
        className={cn(
          'z-30 p-2 rounded-full transition-all duration-200 group/save',
          isSaved 
            ? 'bg-almostblack dark:bg-white' 
            : 'bg-almostblack/10 dark:bg-white/10 hover:bg-almostblack/20 dark:hover:bg-white/20',
          isPending && 'opacity-50 cursor-wait',
          className
        )}
        aria-label={isSaved ? 'Remove from listen later' : 'Add to listen later'}
      >
        <Bookmark 
          className={cn(
            'w-4 h-4 transition-colors',
            isSaved 
              ? 'text-white dark:text-almostblack fill-current' 
              : 'text-almostblack dark:text-white'
          )} 
        />
      </button>
    );
  }

  return (
    <Button
      variant='outline'
      onClick={handleSaveClick}
      className={cn(
        'border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack uppercase font-mono text-m6 px-4 py-2 h-10 rounded-none transition-all duration-200',
        isSaved &&
          'bg-almostblack text-white dark:bg-white dark:text-almostblack border-transparent',
        className
      )}
      aria-label={isSaved ? 'Remove from listen later' : 'Add to listen later'}
    >
      {isSaved ? <Check className='h-4 w-4 mr-2' /> : <Bookmark className='h-4 w-4 mr-2' />}
      {isSaved ? 'Saved to Queue' : 'Listen Later'}
    </Button>
  );
}
