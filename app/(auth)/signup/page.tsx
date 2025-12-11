import { Metadata } from 'next';
import SignUpClient from '@/cosmic/blocks/user-management/SignUpClient';
import { signUp } from '@/cosmic/blocks/user-management/actions';
import { generateBaseMetadata } from '@/lib/metadata-utils';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Sign Up - Worldwide FM',
    description: 'Create a new Worldwide FM account to access personalized content and features.',
    noIndex: true,
  });
};

export default async function SignUpPage() {
  return (
    <div className='container mx-auto py-8 px-4'>
      <SignUpClient onSubmit={signUp} />
    </div>
  );
}
