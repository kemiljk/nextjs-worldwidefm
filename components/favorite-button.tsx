'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import {
  addFavouriteGenre,
  removeFavouriteGenre,
  addFavouriteHost,
  removeFavouriteHost,
} from '@/cosmic/blocks/user-management/actions';
import type { GenreObject, HostObject } from '@/lib/cosmic-config';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  item: GenreObject | HostObject;
  type: 'genre' | 'host';
  isFavorited: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export function FavoriteButton({
  item,
  type,
  isFavorited: initialIsFavorited,
  className,
  variant = 'outline',
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isPending, startTransition] = useTransition();

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    startTransition(async () => {
      let success = false;

      if (isFavorited) {
        if (type === 'genre') {
          const result = await removeFavouriteGenre(user.id, item.id);
          success = result.success;
        } else {
          const result = await removeFavouriteHost(user.id, item.id);
          success = result.success;
        }
      } else {
        if (type === 'genre') {
          const result = await addFavouriteGenre(user.id, item as GenreObject);
          success = result.success;
        } else {
          const result = await addFavouriteHost(user.id, item as HostObject);
          success = result.success;
        }
      }

      if (success) {
        setIsFavorited(!isFavorited);
        router.refresh();
      }
    });
  };

  return (
    <Button
      variant={variant === 'ghost' ? 'ghost' : 'outline'}
      size={variant === 'ghost' ? 'icon' : 'sm'}
      onClick={handleFavoriteClick}
      disabled={isPending}
      className={cn(
        variant !== 'ghost' &&
          'border-almostblack dark:border-white hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack transition-colors',
        variant !== 'ghost' &&
          isFavorited &&
          'bg-almostblack text-white dark:bg-white dark:text-almostblack',
        variant === 'ghost' && 'border-0 p-0 h-auto w-auto hover:bg-transparent',
        className
      )}
      aria-label={isFavorited ? `Remove ${type} from favourites` : `Add ${type} to favourites`}
    >
      <Heart
        className={cn('h-4 w-4', variant !== 'ghost' && 'mr-1', isFavorited && 'fill-current')}
      />
      {variant !== 'ghost' && (isFavorited ? 'Favourited' : 'Favourite')}
    </Button>
  );
}
