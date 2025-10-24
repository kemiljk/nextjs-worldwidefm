import { Metadata } from 'next';
import ForgotPasswordForm from '@/cosmic/blocks/user-management/ForgotPasswordForm';
import { forgotPassword } from '@/cosmic/blocks/user-management/actions';
import { generateBaseMetadata } from '@/lib/metadata-utils';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Forgot Password - Worldwide FM',
    description: "Reset your Worldwide FM account password if you've forgotten it.",
    noIndex: true, // Don't index authentication pages
  });
};

export default function ForgotPasswordPage() {
  return (
    <div className='container mx-auto py-8 px-4'>
      <ForgotPasswordForm onSubmit={forgotPassword} />
    </div>
  );
}
