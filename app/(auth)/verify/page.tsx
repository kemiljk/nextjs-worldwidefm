import { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyClient from '@/cosmic/blocks/user-management/VerifyClient';
import { Loader2 } from 'lucide-react';
import { generateBaseMetadata } from '@/lib/metadata-utils';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Verify Account - Worldwide FM',
    description: 'Verify your Worldwide FM account to complete the registration process.',
    noIndex: true, // Don't index authentication pages
  });
};

export default function VerifyPage() {
  return (
    <Suspense fallback={<Loader2 className='text-accent mx-auto w-8 h-8 animate-spin' />}>
      <VerifyClient />
    </Suspense>
  );
}
