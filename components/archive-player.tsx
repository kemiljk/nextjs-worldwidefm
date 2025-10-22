'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useMediaPlayer } from './providers/media-player-provider';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'no-store';
export const runtime = 'nodejs';

const ArchivePlayer: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isWidgetReady, setIsWidgetReady] = useState(false);

  const {
    selectedMixcloudUrl,
    setSelectedMixcloudUrl,
    selectedShow,
    setSelectedShow,
    playShow,
    pauseShow,
    setWidgetRef,
    widgetRef,
  } = useMediaPlayer();

  // Clear widgetRef and state on show change
  useEffect(() => {
    setWidgetRef(null);
    setIsWidgetReady(false);
  }, [selectedMixcloudUrl, selectedShow, setWidgetRef]);

  useEffect(() => {
    if (!selectedMixcloudUrl || !selectedShow) {
      return;
    }

    console.log('ArchivePlayer: Initializing for show:', selectedShow.name);
    console.log('ArchivePlayer: Mixcloud URL:', selectedMixcloudUrl);
    setHasError(false);
    setIsWidgetReady(false);

    // Load Mixcloud widget script if not already loaded
    if (!window.Mixcloud) {
      const script = document.createElement('script');
      script.src = 'https://widget.mixcloud.com/media/js/widgetApi.js';
      script.async = true;
      script.crossOrigin = 'anonymous'; // Add CORS handling
      script.onload = () => {
        initializeWidget();
      };
      script.onerror = (error) => {
        console.error('Failed to load Mixcloud widget script:', error);
        setHasError(true);
      };
      document.head.appendChild(script);
    } else {
      initializeWidget();
    }
  }, [selectedMixcloudUrl, selectedShow]);

  // Prevent Mixcloud widget from affecting browser history
  useEffect(() => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // Override history methods to prevent widget from affecting navigation
    history.pushState = function (...args) {
      // Only allow our own navigation, block widget navigation
      if (args[2] && typeof args[2] === 'string' && args[2].includes('mixcloud.com')) {
        console.log('Blocked Mixcloud widget history push:', args[2]);
        return;
      }
      return originalPushState.apply(this, args);
    };

    history.replaceState = function (...args) {
      // Only allow our own navigation, block widget navigation
      if (args[2] && typeof args[2] === 'string' && args[2].includes('mixcloud.com')) {
        console.log('Blocked Mixcloud widget history replace:', args[2]);
        return;
      }
      return originalReplaceState.apply(this, args);
    };

    // Cleanup on unmount
    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  const initializeWidget = () => {
    if (!selectedMixcloudUrl || !iframeRef.current) return;

    try {
      // Log current domain for debugging
      const currentDomain = window.location.hostname;
      console.log('Initializing Mixcloud widget for domain:', currentDomain);

      // Create widget URL using official Mixcloud widget parameters
      const widgetParams = new URLSearchParams({
        feed: selectedMixcloudUrl,
        hide_cover: '1',
        autoplay: '1',
        hide_artwork: '1',
        light: '1',
        mini: '1',
      });

      const widgetUrl = `https://www.mixcloud.com/widget/iframe/?${widgetParams.toString()}`;
      console.log('Widget URL:', widgetUrl);

      if (iframeRef.current) {
        iframeRef.current.src = widgetUrl;

        // Add error handling for iframe load
        iframeRef.current.onload = () => {
          console.log('Mixcloud iframe loaded successfully');
        };

        iframeRef.current.onerror = (error) => {
          console.error('Mixcloud iframe failed to load:', error);
          setHasError(true);
        };

        // Try to initialize the widget API for control
        const widgetTimeout = setTimeout(() => {
          if (!isWidgetReady) {
            console.warn('Mixcloud widget API failed to initialize within timeout');
            setHasError(true);
          }
        }, 5000); // 5 second timeout

        setTimeout(() => {
          try {
            if (window.Mixcloud && iframeRef.current) {
              const widget = window.Mixcloud.PlayerWidget(iframeRef.current);
              setWidgetRef(widget);

              widget.ready
                .then(() => {
                  clearTimeout(widgetTimeout);
                  setIsWidgetReady(true);
                  console.log('Mixcloud widget API initialized successfully');
                  // Set up event listeners
                  widget.events.play.on(() => {
                    if (selectedShow) playShow(selectedShow);
                  });
                  widget.events.pause.on(() => pauseShow());
                  widget.events.ended.on(() => pauseShow());
                  widget.events.error.on((error) => {
                    console.error('Mixcloud widget error:', error);
                    setHasError(true);
                  });
                })
                .catch((error) => {
                  clearTimeout(widgetTimeout);
                  console.error('Failed to initialize Mixcloud widget:', error);
                  setIsWidgetReady(false);
                  setHasError(true);
                });
            } else {
              clearTimeout(widgetTimeout);
              console.warn('Mixcloud API not available, using iframe only');
              setHasError(true);
            }
          } catch (err) {
            clearTimeout(widgetTimeout);
            console.error('Widget API not available:', err);
            setIsWidgetReady(false);
            setHasError(true);
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
    // Fallback: show a simple iframe without widget API if CORS fails
    console.log('Using fallback Mixcloud player due to CORS error');
    console.log(
      'Fallback URL:',
      `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(selectedMixcloudUrl)}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`
    );
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
            src={`https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(selectedMixcloudUrl)}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`}
            width='100%'
            height='60'
            allow='autoplay'
            title='Mixcloud Player (Fallback)'
            sandbox='allow-scripts allow-same-origin allow-presentation'
            style={{
              display: 'block',
              margin: 0,
              padding: 0,
              border: 'none',
              verticalAlign: 'bottom',
            }}
            onError={(e) => {
              console.error('Fallback iframe also failed:', e);
            }}
            onLoad={() => {
              console.log('Fallback iframe loaded successfully');
            }}
          />
        </div>
      </div>
    );
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
          sandbox='allow-scripts allow-same-origin allow-presentation'
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
