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
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const hasLoadedInitialShow = useRef(false);

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

  // Handle show changes using widget API load method (skip initial load)
  useEffect(() => {
    if (widgetRef && isWidgetReady && selectedMixcloudUrl && hasLoadedInitialShow.current) {
      console.log('Loading new show via widget API:', selectedMixcloudUrl);
      try {
        widgetRef
          .load(selectedMixcloudUrl, true)
          .then(() => {
            setIsContentLoaded(true);
          })
          .catch(() => {
            setIsContentLoaded(true); // Show even if load fails
          });
      } catch (error) {
        console.error('Failed to load show via widget API:', error);
        setHasError(true);
        setIsContentLoaded(true); // Show even if load fails
      }
    }
  }, [selectedMixcloudUrl, widgetRef, isWidgetReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear iframe src on unmount to prevent any lingering navigation
      if (iframeRef.current) {
        iframeRef.current.src = 'about:blank';
      }
    };
  }, []);

  // Initialize widget when first show is selected
  useEffect(() => {
    if (!selectedMixcloudUrl || !selectedShow) {
      return;
    }

    // Only initialize if widget is not already ready
    if (isWidgetReady) {
      return;
    }

    console.log('ArchivePlayer: Initializing widget for show:', selectedShow.name);
    setHasError(false);
    setIsWidgetReady(false);

    // Load Mixcloud widget script if not already loaded
    if (!window.Mixcloud) {
      const script = document.createElement('script');
      script.src = 'https://widget.mixcloud.com/media/js/widgetApi.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
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
  }, [selectedMixcloudUrl, selectedShow, isWidgetReady]); // Run when show changes but only if not already ready

  // No longer need to block history methods since we're using static iframe URL
  // The static iframe approach prevents bfcache issues without interfering with navigation

  const initializeWidget = () => {
    if (!iframeRef.current) return;

    try {
      // Log current domain for debugging
      const currentDomain = window.location.hostname;
      console.log('Initializing Mixcloud widget for domain:', currentDomain);

      // Use a static widget URL to prevent history entries
      // The widget will be controlled via API instead of changing src
      const staticWidgetUrl =
        'https://www.mixcloud.com/widget/iframe/?hide_cover=1&hide_artwork=1&light=1&mini=1';
      console.log('Static Widget URL:', staticWidgetUrl);

      if (iframeRef.current) {
        // Only set src if it's not already set (first time initialization)
        if (!iframeRef.current.src || iframeRef.current.src === 'about:blank') {
          iframeRef.current.src = staticWidgetUrl;
        }

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

                  // Load the initial show immediately to prevent "Sorry we couldn't find that" message
                  if (selectedMixcloudUrl) {
                    widget
                      .load(selectedMixcloudUrl, true)
                      .then(() => {
                        setIsContentLoaded(true);
                      })
                      .catch(() => {
                        setIsContentLoaded(true); // Show even if load fails
                      });
                    hasLoadedInitialShow.current = true;
                  }

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

    // Clear the iframe src to prevent any ongoing navigation
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
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
    console.log('Fallback URL with static src to prevent history issues');
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
            sandbox='allow-scripts allow-same-origin allow-presentation allow-forms'
            referrerPolicy='no-referrer'
            loading='lazy'
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
          sandbox='allow-scripts allow-same-origin allow-presentation allow-forms'
          referrerPolicy='no-referrer'
          loading='lazy'
          style={{
            display: isContentLoaded ? 'block' : 'none',
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
