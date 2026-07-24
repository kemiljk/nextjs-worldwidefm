import { Metadata } from 'next';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { UpdateTracklistForm } from './update-tracklist-form';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Update Tracklist - Worldwide FM',
    description: 'Add or update the tracklist for a live show on Worldwide FM.',
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
        For live shows: pick today&apos;s (or your) broadcast date, select your show, then paste the
        tracklist — one track per line (Artist - Track [Label]). It will appear on the show page
        after the broadcast ends.
      </p>
      <div className='bg-background border rounded-none p-6'>
        <UpdateTracklistForm />
      </div>
    </div>
  );
}
