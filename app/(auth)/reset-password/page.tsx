import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ResetPasswordForm from '@/cosmic/blocks/user-management/ResetPasswordForm';
import { resetPassword } from '@/cosmic/blocks/user-management/actions';
import { generateBaseMetadata } from '@/lib/metadata-utils';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Reset Password - Worldwide FM',
    description: 'Set a new password for your Worldwide FM account.',
    noIndex: true, // Don't index authentication pages
  });
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect('/login');
  }

  return (
    <div className='container mx-auto py-8 px-4'>
      <ResetPasswordForm token={token} onSubmit={resetPassword} />
    </div>
  );
}
