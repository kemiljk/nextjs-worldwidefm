import { Metadata } from 'next';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { UpdateTracklistForm } from './update-tracklist-form';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Update Tracklist - Worldwide FM',
    description: 'Update the tracklist, genres, and image for a live show on Worldwide FM.',
    noIndex: true,
  });
};

export default function UpdateTracklistPage() {
  return (
    <div className='container mx-auto py-8'>
      <h1 className='text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-2'>
        Update Tracklist
      </h1>
      <p className='text-muted-foreground mb-6'>
        For live shows: pick today&apos;s (or your) broadcast date, select your show, then update
        its tracklist, music genres, or image. Tracklists should have one track per line (Artist -
        Track [Label]). Your changes will appear on the show page after saving.
      </p>
      <div className='bg-background border rounded-none p-6'>
        <UpdateTracklistForm />
      </div>
    </div>
  );
}
