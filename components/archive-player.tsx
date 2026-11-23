'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useMediaPlayer } from './providers/media-player-provider';
import { usePlausible } from 'next-plausible';
import { Button } from '@/components/ui/button';

const ArchivePlayer: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetInitializedRef = useRef(false);
  const plausible = usePlausible();

  const {
    selectedArchiveUrl,
    setSelectedArchiveUrl,
    selectedShow,
    setSelectedShow,
    pauseShow,
    setWidgetRef,
  } = useMediaPlayer();

  // Only show loading state if iframe takes longer than 2 seconds to load
  useEffect(() => {
    if (selectedArchiveUrl) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(true);
      }, 2000);

      if (selectedShow) {
        plausible('Archive Show Played', {
          props: {
            show: selectedShow.name || 'Unknown',
            slug: selectedShow.slug || '',
          },
        });
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [selectedArchiveUrl, selectedShow, plausible]);

  const handleLoad = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    setIsLoading(false);

    const isSoundCloud = selectedArchiveUrl?.includes('soundcloud.com');
    if (iframeRef.current && !widgetInitializedRef.current && !isSoundCloud) {
      try {
        if (!window.Mixcloud) {
          const script = document.createElement('script');
          script.src = 'https://widget.mixcloud.com/media/js/widgetApi.js';
          script.onload = () => {
            initializeWidget();
          };
          document.body.appendChild(script);
        } else {
          initializeWidget();
        }
      } catch (error) {
        console.error('Failed to initialize Mixcloud widget:', error);
      }
    }
  };

  const initializeWidget = () => {
    if (!iframeRef.current || widgetInitializedRef.current) return;

    try {
      const widget = window.Mixcloud?.PlayerWidget(iframeRef.current);
      if (!widget) return;
      setWidgetRef(widget);
      widgetInitializedRef.current = true;

      widget.ready.then(() => {
        widget.events.pause.on(() => {
          console.log('[ArchivePlayer] Widget paused');
        });

        widget.events.play.on(() => {
          console.log('[ArchivePlayer] Widget playing');
        });
      });
    } catch (error) {
      console.error('Failed to create Mixcloud widget:', error);
    }
  };

  const handleClose = () => {
    if (selectedShow) {
      plausible('Archive Player Closed', {
        props: {
          show: selectedShow.name || 'Unknown',
          slug: selectedShow.slug || '',
        },
      });
    }

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    setIsLoading(false);
    widgetInitializedRef.current = false;
    setWidgetRef(null);
    setSelectedArchiveUrl(null);
    setSelectedShow(null);
    pauseShow();
  };

  useEffect(() => {
    widgetInitializedRef.current = false;
  }, [selectedArchiveUrl]);

  const shouldShowPlayer = selectedArchiveUrl && selectedShow;

  if (!shouldShowPlayer) {
    return null;
  }

  const isSoundCloud = selectedArchiveUrl.includes('soundcloud.com');

  const embedUrl = isSoundCloud
    ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(selectedArchiveUrl)}&color=%23ff5500&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`
    : `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(selectedArchiveUrl)}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`;

  return (
    <div
      className='fixed bottom-0 left-0 right-0 z-50 bg-[#f7f7f7] border-t border-almostblack/50 overflow-hidden'
      style={{ height: '60px' }}
    >
      <div className='relative h-full'>
        <Button
          onClick={handleClose}
          className='absolute right-0 z-50 text-almostblack dark:text-white hover:text-white bg-[#f7f7f7] flex h-[60px] aspect-square'
          aria-label='Close player'
        >
          <X className='w-5  h-5' />
        </Button>
        {isLoading && (
          <div className='absolute inset-0 bg-white dark:bg-almostblack flex items-center justify-center border-t border-gray-200 dark:border-gray-700'>
            <div className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
              <div className='animate-spin rounded-full h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400'></div>
              <span>Loading player...</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={selectedArchiveUrl}
          src={embedUrl}
          className='w-[calc(100vw-60px)] h-[60px]'
          allow='autoplay'
          title={isSoundCloud ? 'SoundCloud Player' : 'Mixcloud Player'}
          referrerPolicy='no-referrer'
          onLoad={handleLoad}
          onError={handleLoad}
          style={{
            display: 'block',
            margin: 0,
            padding: 0,
            border: 'none',
            verticalAlign: 'bottom',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.2s ease-in',
          }}
        />
      </div>
    </div>
  );
};

export default ArchivePlayer;
