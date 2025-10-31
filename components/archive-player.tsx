'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useMediaPlayer } from './providers/media-player-provider';
import { usePlausible } from 'next-plausible';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'no-store';
export const runtime = 'nodejs';

const ArchivePlayer: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetInitializedRef = useRef(false);
  const plausible = usePlausible();

  const {
    selectedMixcloudUrl,
    setSelectedMixcloudUrl,
    selectedShow,
    setSelectedShow,
    pauseShow,
    setWidgetRef,
  } = useMediaPlayer();

  // Only show loading state if iframe takes longer than 2 seconds to load
  useEffect(() => {
    if (selectedMixcloudUrl) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Only show loading state after 2 second delay
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(true);
      }, 2000);

      // Track show play
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
  }, [selectedMixcloudUrl, selectedShow, plausible]);

  const handleLoad = () => {
    // Clear the timeout if iframe loads quickly
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    setIsLoading(false);

    // Initialize Mixcloud Widget API
    if (iframeRef.current && !widgetInitializedRef.current) {
      try {
        // Load Mixcloud widget API script if not already loaded
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

      // Listen to play/pause events from the widget
      widget.ready.then(() => {
        widget.events.pause.on(() => {
          // Widget was paused
          console.log('[ArchivePlayer] Widget paused');
        });

        widget.events.play.on(() => {
          // Widget started playing
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
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    pauseShow();
  };

  // Reset widget initialization when URL changes
  useEffect(() => {
    widgetInitializedRef.current = false;
  }, [selectedMixcloudUrl]);

  // Only render when there's a show selected
  const shouldShowPlayer = selectedMixcloudUrl && selectedShow;

  if (!shouldShowPlayer) {
    return null;
  }

  // Build iframe URL - similar to Vue app approach
  const embedUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(selectedMixcloudUrl)}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`;

  return (
    <div className='fixed bottom-0 left-0 right-0 z-50 overflow-hidden' style={{ height: '60px' }}>
      <div className='relative h-full'>
        <button
          onClick={handleClose}
          className='absolute top-1.5 right-1 z-50 text-almostblack dark:text-white hover:opacity-50 transition-opacity bg-white/80 dark:bg-almostblack/80 rounded-full'
          aria-label='Close player'
        >
          <X className='w-4 h-4' />
        </button>
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
          key={selectedMixcloudUrl}
          src={embedUrl}
          width='100%'
          height='60'
          allow='autoplay'
          title='Mixcloud Player'
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
