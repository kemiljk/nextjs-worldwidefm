'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import {
  addListenLater,
  removeListenLater,
} from '@/cosmic/blocks/user-management/actions';
import { cn } from '@/lib/utils';

interface SaveShowButtonProps {
  show: { id: string; slug: string; title: string };
  isSaved: boolean;
  className?: string;
}

export function SaveShowButton({
  show,
  isSaved: initialIsSaved,
  className,
}: SaveShowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [isPending, startTransition] = useTransition();

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    startTransition(async () => {
      let success = false;

      if (isSaved) {
        const result = await removeListenLater(user.id, show.id);
        success = result.success;
      } else {
        const result = await addListenLater(user.id, { id: show.id });
        success = result.success;
      }

      if (success) {
        setIsSaved(!isSaved);
        router.refresh();
      }
    });
  };

  return (
    <Button
      variant='outline'
      onClick={handleSaveClick}
      disabled={isPending}
      className={cn(
        'border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack uppercase font-mono text-m6 px-4 py-2 h-10 rounded-none transition-all duration-200',
        isSaved && 'bg-almostblack text-white dark:bg-white dark:text-almostblack border-transparent',
        className
      )}
      aria-label={isSaved ? 'Remove from listen later' : 'Add to listen later'}
    >
      {isSaved ? (
        <Check className='h-4 w-4 mr-2' />
      ) : (
        <Bookmark className='h-4 w-4 mr-2' />
      )}
      {isSaved ? 'Saved to Queue' : 'Listen Later'}
    </Button>
  );
}
