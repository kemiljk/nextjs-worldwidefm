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
  const [isLoading, setIsLoading] = useState(true);

  const { selectedMixcloudUrl, setSelectedMixcloudUrl, selectedShow, setSelectedShow, pauseShow } =
    useMediaPlayer();

  // Handle show changes by setting iframe src directly
  useEffect(() => {
    if (!selectedMixcloudUrl || !iframeRef.current) return;

    // Show loading state
    setIsLoading(true);

    // Build iframe URL with feed parameter
    const widgetUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(selectedMixcloudUrl)}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`;

    // Set iframe src directly
    iframeRef.current.src = widgetUrl;
  }, [selectedMixcloudUrl]);

  const handleClose = () => {
    // Clear the iframe src to prevent any ongoing navigation
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }

    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
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
          onLoad={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
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
