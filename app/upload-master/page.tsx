import { Metadata } from 'next';
import { UploadMasterForm } from './upload-master-form';
import { generateBaseMetadata } from '@/lib/metadata-utils';

export const maxDuration = 300;

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Upload Master - Worldwide FM',
    description: 'Upload mastered audio to RadioCult and Mixcloud for archiving.',
    noIndex: true,
  });
};

export default function UploadMasterPage() {
  return (
    <div className='container mx-auto py-8'>
      <h1 className='text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-6'>
        Upload Mastered Audio
      </h1>
      <div className='bg-background border rounded-none p-6'>
        <UploadMasterForm />
      </div>
    </div>
  );
}
