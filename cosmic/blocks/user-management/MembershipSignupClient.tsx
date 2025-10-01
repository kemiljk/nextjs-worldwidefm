'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import { Button } from '@/cosmic/elements/Button';
import { Input } from '@/cosmic/elements/Input';
import { Label } from '@/cosmic/elements/Label';
import { Loader2, CheckCircle, CreditCard, Star, Headphones, Zap } from 'lucide-react';

export default function MembershipSignupClient() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      // User is already logged in, they can proceed to subscription
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center p-4'>
        <Loader2 className='size-8 animate-spin text-primary' />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className='py-8'>
        <div className='mx-auto max-w-md'>
          <div className='bg-card p-8 shadow-xs text-center'>
            <CheckCircle className='mx-auto size-16 text-green-500 mb-4' />
            <h2 className='font-display uppercase text-2xl font-normal tracking-tight mb-4'>
              Welcome to Worldwide FM!
            </h2>
            <p className='text-muted-foreground mb-6'>
              Your membership subscription is being processed. You'll receive a confirmation email
              shortly.
            </p>
            <Link
              className='text-almostblack dark:text-white'
              href='/dashboard'
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get('email') as string;
      const firstName = formData.get('firstName') as string;
      const lastName = formData.get('lastName') as string;

      // Create Stripe checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          userId: user?.id,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const membershipFeatures = [
    {
      icon: <Headphones className='size-6' />,
      title: 'Ad-Free Listening',
      description: 'Enjoy uninterrupted music without advertisements',
    },
    {
      icon: <Star className='size-6' />,
      title: 'Exclusive Content',
      description: 'Access to member-only shows and special broadcasts',
    },
    {
      icon: <Zap className='size-6' />,
      title: 'Early Access',
      description: 'Be the first to hear new episodes and special releases',
    },
  ];

  return (
    <div className='py-8'>
      <div className='mx-auto max-w-4xl'>
        {/* Header */}
        <div className='text-center mb-12'>
          <h1 className='font-display uppercase text-4xl font-normal tracking-tight mb-4'>
            Worldwide FM Membership
          </h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
            Join our community of music lovers and get exclusive access to ad-free listening,
            member-only content, and early access to new shows.
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-8'>
          {/* Features */}
          <div className='space-y-6'>
            <h2 className='font-display uppercase text-2xl font-normal tracking-tight'>
              Membership Benefits
            </h2>
            <div className='space-y-4'>
              {membershipFeatures.map((feature, index) => (
                <div
                  key={index}
                  className='flex items-start space-x-4'
                >
                  <div className='text-primary mt-1'>{feature.icon}</div>
                  <div>
                    <h3 className='font-medium text-lg'>{feature.title}</h3>
                    <p className='text-muted-foreground'>{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signup Form */}
          <div className='bg-card p-8 shadow-xs'>
            <div className='flex items-center space-x-2 mb-6'>
              <CreditCard className='size-6 text-primary' />
              <h2 className='font-display uppercase text-2xl font-normal tracking-tight'>
                Subscribe Now
              </h2>
            </div>

            {error && (
              <div className='mb-6 p-4 bg-crimson-50 border border-crimson-200 text-crimson-800 text-sm'>
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className='space-y-6'
            >
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='firstName'>First Name</Label>
                  <Input
                    type='text'
                    id='firstName'
                    name='firstName'
                    required
                    placeholder='First name'
                    defaultValue={user?.name?.split(' ')[0] || ''}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='lastName'>Last Name</Label>
                  <Input
                    type='text'
                    id='lastName'
                    name='lastName'
                    required
                    placeholder='Last name'
                    defaultValue={user?.name?.split(' ')[1] || ''}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='email'>Email</Label>
                <Input
                  type='email'
                  id='email'
                  name='email'
                  required
                  placeholder='Enter your email'
                  defaultValue={user?.email || ''}
                />
              </div>

              <div className='bg-gray-50 dark:bg-gray-800 p-4 rounded-lg'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h3 className='font-medium'>Monthly Membership</h3>
                    <p className='text-sm text-muted-foreground'>Cancel anytime</p>
                  </div>
                  <div className='text-right'>
                    <span className='text-2xl font-bold'>$9.99</span>
                    <span className='text-sm text-muted-foreground'>/month</span>
                  </div>
                </div>
              </div>

              <Button
                type='submit'
                disabled={isProcessing}
                className='w-full'
              >
                {isProcessing ? (
                  <>
                    <Loader2 className='size-4 animate-spin mr-2' />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className='size-4 mr-2' />
                    Subscribe with Stripe
                  </>
                )}
              </Button>
            </form>

            <div className='mt-6 text-center text-sm text-muted-foreground'>
              {!user ? (
                <>
                  Already have an account?{' '}
                  <Link
                    href='/login'
                    className='text-primary hover:underline font-medium'
                  >
                    Login
                  </Link>{' '}
                  or{' '}
                  <Link
                    href='/signup'
                    className='text-primary hover:underline font-medium'
                  >
                    Sign up
                  </Link>
                </>
              ) : (
                <>
                  Need to update your account?{' '}
                  <Link
                    href='/dashboard'
                    className='text-primary hover:underline font-medium'
                  >
                    Go to Dashboard
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
