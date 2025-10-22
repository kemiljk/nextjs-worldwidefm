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
  const hasPreloadedRef = useRef(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { selectedMixcloudUrl, setSelectedMixcloudUrl, selectedShow, setSelectedShow, pauseShow } =
    useMediaPlayer();

  // Preload iframe in background for faster first play (run once)
  useEffect(() => {
    if (iframeRef.current && !selectedMixcloudUrl && !hasPreloadedRef.current) {
      const preloadUrl =
        'https://www.mixcloud.com/widget/iframe/?hide_cover=1&hide_artwork=1&light=1&mini=1';
      console.log('[ArchivePlayer] Preloading Mixcloud widget iframe');
      iframeRef.current.src = preloadUrl;
      hasPreloadedRef.current = true;
    }
  }, [selectedMixcloudUrl]);

  // Prevent bfcache when player is active by adding unload listener
  useEffect(() => {
    if (!selectedMixcloudUrl) return;

    // Adding an unload event listener disqualifies the page from bfcache
    const handleUnload = () => {
      // This intentionally does nothing - just prevents bfcache
    };

    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('unload', handleUnload);
    };
  }, [selectedMixcloudUrl]);

  // Align bfcache behavior between environments: blank on pagehide, restore on pageshow
  useEffect(() => {
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted && iframeRef.current) {
        console.log(
          '[ArchivePlayer] pagehide (persisted) -> blanking iframe to avoid cached player history'
        );
        iframeRef.current.src = 'about:blank';
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[ArchivePlayer] pageshow (persisted) -> restoring current show');
        if (selectedMixcloudUrl && iframeRef.current) {
          const widgetUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(
            selectedMixcloudUrl
          )}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`;
          iframeRef.current.src = widgetUrl;
        }
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [selectedMixcloudUrl]);

  // Handle show changes by setting iframe src
  useEffect(() => {
    if (!selectedMixcloudUrl || !iframeRef.current) return;

    // Show loading state
    setIsLoading(true);
    setHasError(false);

    // Build iframe URL with feed parameter
    const widgetUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(selectedMixcloudUrl)}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`;

    // Set iframe src directly
    iframeRef.current.src = widgetUrl;

    // Fallback: if onLoad doesn't fire within 2 seconds, show the iframe anyway
    const fallbackTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    // Store timeout ref for cleanup
    iframeRef.current.dataset.timeout = fallbackTimeout.toString();
  }, [selectedMixcloudUrl]);

  const handleClose = () => {
    // Clear the iframe src to stop playback
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }

    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    pauseShow();
  };

  // Always render the component to allow preloading, but hide it when no show is selected
  const shouldShowPlayer = selectedMixcloudUrl && selectedShow;

  if (hasError && shouldShowPlayer) {
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
            sandbox='allow-scripts allow-same-origin allow-forms'
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
    <div
      className='fixed bottom-0 left-0 right-0 z-50 overflow-hidden'
      style={{
        height: '60px',
        display: shouldShowPlayer ? 'block' : 'none',
      }}
    >
      <div className='relative h-full'>
        <button
          onClick={handleClose}
          className='absolute top-1.5 right-1 z-50 text-almostblack dark:text-white hover:opacity-50 transition-opacity bg-white/80 dark:bg-almostblack/80 rounded-full'
          aria-label='Close player'
        >
          <X className='w-4 h-4' />
        </button>
        {isLoading && shouldShowPlayer && (
          <div className='absolute inset-0 bg-white dark:bg-almostblack flex items-center justify-center border-t border-gray-200 dark:border-gray-700 animate-pulse'>
            <div className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
              <div className='animate-spin rounded-full h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400'></div>
              <span>Loading player...</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          width='100%'
          height='60'
          allow='autoplay'
          title='Mixcloud Player'
          sandbox='allow-scripts allow-same-origin allow-forms'
          referrerPolicy='no-referrer'
          loading='lazy'
          onLoad={() => {
            setIsLoading(false);
            setHasError(false);
            // Clear the fallback timeout
            if (iframeRef.current?.dataset.timeout) {
              clearTimeout(parseInt(iframeRef.current.dataset.timeout));
            }
          }}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
            // Clear the fallback timeout
            if (iframeRef.current?.dataset.timeout) {
              clearTimeout(parseInt(iframeRef.current.dataset.timeout));
            }
          }}
          style={{
            display: isLoading ? 'none' : 'block',
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
