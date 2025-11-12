'use client';

import { useState, useMemo } from 'react';
import { Tracklist } from './tracklist';

function countTracks(htmlContent: string): number {
  if (!htmlContent) return 0;

  // Normalize HTML: replace <br> tags with newlines, handle <p> tags
  // This handles both simple <br /> formats and Rich Text editor formats with <p> tags
  const normalizedContent = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '');

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = normalizedContent;
  const textContent = tempDiv.textContent || '';
  const lines = textContent.split('\n');

  return lines.filter(line => line.trim()).length;
}

export function TracklistToggle({ tracklist }: { tracklist: string }) {
  const [showTracklist, setShowTracklist] = useState(false);

  const trackCount = useMemo(() => countTracks(tracklist), [tracklist]);

  return (
    <div className='w-full space-y-4'>
      <button
        className='text-m8 md:text-m7 font-mono uppercase bg-almostblack text-white hover:bg-white hover:cursor-pointer hover:border-almostblack hover:text-almostblack border p-2 px-3'
        onClick={() => setShowTracklist(prev => !prev)}
      >
        Tracklist
      </button>

      {showTracklist && (
        <div>
          <Tracklist content={tracklist} />
        </div>
      )}
      <div className='font-mono uppercase text-m8'>({trackCount} tracks)</div>
    </div>
  );
}
