'use client';

import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { useMediaPlayer } from '@/components/providers/media-player-provider';
import { usePlausible } from 'next-plausible';

interface ListenBackButtonProps {
  show: any;
}

export function ListenBackButton({ show }: ListenBackButtonProps) {
  const { selectedShow, playShow, pauseShow, isArchivePlaying } = useMediaPlayer();
  const plausible = usePlausible();

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isArchivePlaying;

  const handleClick = () => {
    if (isCurrentShow) {
      if (isCurrentlyPlaying) {
        plausible('Episode Paused', {
          props: {
            show: show.name || show.title || 'Unknown',
            slug: show.slug || '',
          },
        });
        pauseShow();
      } else {
        plausible('Episode Resumed', {
          props: {
            show: show.name || show.title || 'Unknown',
            slug: show.slug || '',
          },
        });
        playShow(show);
      }
    } else {
      plausible('Episode Play Button Clicked', {
        props: {
          show: show.name || show.title || 'Unknown',
          slug: show.slug || '',
        },
      });
      playShow(show);
    }
  };

  const isEpisode = show?.__source === 'episode' || show?.episodeData || show?.type === 'episode';
  const hasAudioContent = show?.url || show?.player || show?.metadata?.player;

  if (!isEpisode && !hasAudioContent) return null;

  return (
    <Button
      onClick={handleClick}
      variant='default'
      className='bg-almostblack text-white! dark:text-white! hover:bg-almostblack/80 hover:text-white! uppercase font-mono text-m6 px-4 py-2 h-10'
      aria-label={
        isCurrentlyPlaying
          ? `Pause ${show.name || show.title}`
          : `Listen Back to ${show.name || show.title}`
      }
    >
      {isCurrentlyPlaying ? (
        <>
          <Pause fill='white' className='h-4 w-4 mr-2' />
          <span className='text-white'>Pause</span>
        </>
      ) : (
        <>
          <Play fill='white' className='h-4 w-4 mr-2' />
          <span className='text-white'>Listen Back</span>
        </>
      )}
    </Button>
  );
}
