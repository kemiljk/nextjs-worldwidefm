'use client';

import { useState } from 'react';
import { Tracklist } from './tracklist';

export function TracklistToggle({ tracklist }: { tracklist: string }) {
  const [showTracklist, setShowTracklist] = useState(false);

  return (
    <div className='w-full space-y-4'>
      <button
        className='text-m8 md:text-m7 font-mono uppercase bg-almostblack text-white hover:bg-white hover:cursor-pointer hover:border-almostblack hover:text-almostblack border p-2 px-3'
        onClick={() => setShowTracklist((prev) => !prev)}
      >
        Tracklist
      </button>

      {showTracklist && (
        <div>
          <Tracklist content={tracklist} />
        </div>
      )}
      <div className='font-mono uppercase text-m8'>
        ({tracklist.split('\n').filter((line) => line.trim()).length} tracks)
      </div>
    </div>
  );
}
