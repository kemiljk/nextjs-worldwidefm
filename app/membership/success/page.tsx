import { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, Headphones, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: 'Welcome to Worldwide FM Membership!',
    description:
      'Your Worldwide FM membership subscription is now active. Enjoy exclusive content and ad-free listening.',
    noIndex: true,
  };
};

export default function MembershipSuccessPage() {
  const membershipFeatures = [
    {
      icon: <Headphones className='size-8' />,
      title: 'Ad-Free Listening',
      description: 'Enjoy uninterrupted music without advertisements',
    },
    {
      icon: <Star className='size-8' />,
      title: 'Exclusive Content',
      description: 'Access to member-only shows and special broadcasts',
    },
    {
      icon: <Zap className='size-8' />,
      title: 'Early Access',
      description: 'Be the first to hear new episodes and special releases',
    },
  ];

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
            with all the details about your new membership benefits.
          </p>
        </div>

        <div className='bg-card p-8 shadow-xs mb-8'>
          <h2 className='font-display uppercase text-2xl font-normal tracking-tight mb-6'>
            Your Membership Benefits
          </h2>
          <div className='grid md:grid-cols-3 gap-6'>
            {membershipFeatures.map((feature, index) => (
              <div
                key={index}
                className='text-center'
              >
                <div className='text-primary mb-4 flex justify-center'>{feature.icon}</div>
                <h3 className='font-medium text-lg mb-2'>{feature.title}</h3>
                <p className='text-muted-foreground text-sm'>{feature.description}</p>
              </div>
            ))}
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
