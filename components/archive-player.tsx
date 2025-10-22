'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useMediaPlayer } from './providers/media-player-provider';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'no-store';
export const runtime = 'nodejs';

const ArchivePlayer: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  const { selectedMixcloudUrl, setSelectedMixcloudUrl, selectedShow, setSelectedShow, pauseShow } =
    useMediaPlayer();

  const handleClose = () => {
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    pauseShow();
  };

  // Only render when there's a show selected
  const shouldShowPlayer = selectedMixcloudUrl && selectedShow;

  if (!shouldShowPlayer) {
    return null;
  }

  // Build iframe URL - similar to Vue app approach
  const embedUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(selectedMixcloudUrl)}&hide_cover=1&autoplay=1&hide_artwork=1&light=1&mini=1`;

  return (
    <div
      className='fixed bottom-0 left-0 right-0 z-50 overflow-hidden'
      style={{ height: '60px' }}
    >
      <div className='relative h-full'>
        <button
          onClick={handleClose}
          className='absolute top-1.5 right-1 z-50 text-almostblack dark:text-white hover:opacity-50 transition-opacity bg-white/80 dark:bg-almostblack/80 rounded-full'
          aria-label='Close player'
        >
          <X className='w-4 h-4' />
        </button>
        {isLoading && (
          <div className='absolute inset-0 bg-white dark:bg-almostblack flex items-center justify-center border-t border-gray-200 dark:border-gray-700 animate-pulse'>
            <div className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
              <div className='animate-spin rounded-full h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400'></div>
              <span>Loading player...</span>
            </div>
          </div>
        )}
        <iframe
          key={selectedMixcloudUrl}
          src={embedUrl}
          width='100%'
          height='60'
          allow='autoplay'
          title='Mixcloud Player'
          referrerPolicy='no-referrer'
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
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
