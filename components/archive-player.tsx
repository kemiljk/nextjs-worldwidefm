'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useMediaPlayer } from './providers/media-player-provider';

const ArchivePlayer: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isWidgetReady, setIsWidgetReady] = useState(false);

  const {
    selectedMixcloudUrl,
    setSelectedMixcloudUrl,
    selectedShow,
    setSelectedShow,
    isLivePlaying,
    playShow,
    pauseShow,
    stopAllPlayers,
    isArchivePlaying,
    setWidgetRef,
    widgetRef,
  } = useMediaPlayer();

  const isPlaying = isArchivePlaying;

  // Clear widgetRef and state on show change
  useEffect(() => {
    setWidgetRef(null);
    setIsWidgetReady(false);
  }, [selectedMixcloudUrl, selectedShow, setWidgetRef]);

  useEffect(() => {
    if (!selectedMixcloudUrl || !selectedShow) {
      return;
    }

    setHasError(false);
    setIsWidgetReady(false);

    // Load Mixcloud widget script if not already loaded
    if (!window.Mixcloud) {
      const script = document.createElement('script');
      script.src = 'https://widget.mixcloud.com/media/js/widgetApi.js';
      script.async = true;
      script.onload = () => {
        initializeWidget();
      };
      script.onerror = () => {
        setHasError(true);
      };
      document.head.appendChild(script);
    } else {
      initializeWidget();
    }
  }, [selectedMixcloudUrl, selectedShow]);

  const initializeWidget = () => {
    if (!selectedMixcloudUrl || !iframeRef.current) return;

    try {
      // Create widget URL
      const widgetParams = new URLSearchParams({
        feed: selectedMixcloudUrl,
        hide_cover: '1',
        autoplay: '1',
        hide_artwork: '1',
        light: '1',
      });

      const widgetUrl = `https://www.mixcloud.com/widget/iframe/?${widgetParams.toString()}`;

      if (iframeRef.current) {
        iframeRef.current.src = widgetUrl;

        // Try to initialize the widget API for control
        setTimeout(() => {
          try {
            if (window.Mixcloud && iframeRef.current) {
              const widget = window.Mixcloud.PlayerWidget(iframeRef.current);
              setWidgetRef(widget);

              widget.ready
                .then(() => {
                  setIsWidgetReady(true);
                  // Set up event listeners
                  widget.events.play.on(() => {
                    if (selectedShow) playShow(selectedShow);
                  });
                  widget.events.pause.on(() => pauseShow());
                  widget.events.ended.on(() => pauseShow());
                })
                .catch(() => {
                  setIsWidgetReady(false);
                });
            }
          } catch (err) {
            setIsWidgetReady(false);
            console.log('Widget API not available, using iframe only');
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to initialize Mixcloud widget:', error);
      setHasError(true);
      setIsWidgetReady(false);
    }
  };

  const handleClose = () => {
    if (widgetRef && isWidgetReady) {
      try {
        widgetRef.pause();
      } catch (err) {
        // Ignore if widget control not available
      }
    }
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    setIsWidgetReady(false);
    setWidgetRef(null);
    pauseShow();
  };

  if (!selectedMixcloudUrl || !selectedShow) {
    return null;
  }

  if (hasError) {
    return null;
  }

  return (
    <div className='fixed bottom-0 left-0 right-0 z-50 overflow-hidden'>
      <div className='relative'>
        <button
          onClick={handleClose}
          className='absolute top-1.5 right-1 z-50 text-almostblack dark:text-white hover:opacity-50 transition-opacity bg-white/80 dark:bg-almostblack/80 rounded-full'
          aria-label='Close player'
        >
          <X className='w-4 h-4' />
        </button>
        <iframe
          ref={iframeRef}
          width='100%'
          height='60'
          allow='autoplay'
          title='Mixcloud Player'
          style={{
            display: 'block',
            margin: 0,
            padding: 0,
            border: 'none',
            verticalAlign: 'bottom',
          }}
        />
      </div>
    </div>
  );
};

export default ArchivePlayer;
