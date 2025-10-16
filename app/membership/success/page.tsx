import { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: 'Welcome to Worldwide FM Membership!',
    description:
      'Your Worldwide FM membership subscription is now active. Thank you for supporting independent radio.',
    noIndex: true,
  };
};

export default function MembershipSuccessPage() {
  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='max-w-2xl mx-auto text-center'>
        <div className='mb-8'>
          <CheckCircle className='mx-auto size-20 text-green-500 mb-6' />
          <h1 className='font-display uppercase text-4xl font-normal tracking-tight mb-4'>
            Welcome to Worldwide FM!
          </h1>
          <p className='text-lg text-muted-foreground mb-8'>
            Your membership subscription is now active. You'll receive a confirmation email shortly
            with all the details.
          </p>
        </div>

        <div className='bg-card p-8 shadow-xs mb-8'>
          <h2 className='font-display uppercase text-2xl font-normal tracking-tight mb-6'>
            Thank You for Your Support
          </h2>
          <div className='max-w-lg mx-auto'>
            <p className='text-muted-foreground'>
              Your support helps keep Worldwide FM independent and enables us to continue bringing
              you quality music from around the world. Thank you for being part of our community.
            </p>
          </div>
        </div>

        <div className='space-y-4'>
          <Button
            asChild
            className='w-full'
          >
            <Link href='/dashboard'>Go to Dashboard</Link>
          </Button>
          <Button
            variant='outline'
            asChild
            className='w-full'
          >
            <Link href='/shows'>Start Listening</Link>
          </Button>
        </div>

        <div className='mt-8 text-sm text-muted-foreground'>
          <p>
            Need help? Contact us at{' '}
            <a
              href='mailto:support@worldwidefm.net'
              className='text-primary hover:underline'
            >
              support@worldwidefm.net
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
