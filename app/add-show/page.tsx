import { Metadata } from 'next';
import { AddShowForm } from './add-show-form';
import { generateBaseMetadata } from '@/lib/metadata-utils';

// Allow up to 5 minutes for large file uploads (600MB+)
export const maxDuration = 300;

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Add Show - Worldwide FM',
    description: 'Add a new show to the Worldwide FM schedule.',
    noIndex: true, // Don't index admin pages
  });
};

export default function AddShowPage() {
  return (
    <div className='container mx-auto py-8'>
      <h1 className='text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-6'>
        Add Show
      </h1>
      <div className='bg-background border rounded-none p-6'>
        <AddShowForm />
      </div>
    </div>
  );
}
