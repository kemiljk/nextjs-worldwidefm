import { Metadata } from 'next';
import { Suspense } from 'react';
import ForgotPasswordForm from '@/cosmic/blocks/user-management/ForgotPasswordForm';
import { forgotPassword } from '@/cosmic/blocks/user-management/actions';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { Loader2 } from 'lucide-react';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Forgot Password - Worldwide FM',
    description: "Reset your Worldwide FM account password if you've forgotten it.",
    noIndex: true,
  });
};

export default async function ForgotPasswordPage() {
  return (
    <div className='container mx-auto py-8 px-4'>
      <Suspense fallback={<Loader2 className='text-accent mx-auto w-8 h-8 animate-spin' />}>
        <ForgotPasswordForm onSubmit={forgotPassword} />
      </Suspense>
    </div>
  );
}
