'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import { Button } from '@/cosmic/elements/Button';
import { Input } from '@/cosmic/elements/Input';
import { Label } from '@/cosmic/elements/Label';
import { Loader2, CheckCircle } from 'lucide-react';

interface MembershipSignupClientProps {
  heading: string;
  body: string;
}

export default function MembershipSignupClient({ heading, body }: MembershipSignupClientProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });

  useEffect(() => {
    if (!isLoading && user) {
      const nameParts = user.name?.split(' ') || [];
      setFormData({
        email: user.email || '',
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
      });
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className='flex w-screen min-h-screen items-center justify-center'>
        <Loader2 className='size-8 animate-spin text-white' />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className='w-screen min-h-screen flex items-center justify-center relative overflow-hidden'>
        <div className='absolute inset-0 bg-soul-200' />
        <div
          className='absolute inset-0 bg-gradient-to-b from-white via-white/0 to-white'
          style={{ mixBlendMode: 'hue' }}
        />
        <div
          className='absolute inset-0'
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '50px 50px',
            mixBlendMode: 'multiply',
          }}
        />
        <div className='relative z-10 text-center px-5 max-w-4xl mx-auto'>
          <CheckCircle className='mx-auto size-16 text-white mb-4' />
          <h2 className='font-display uppercase text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-white'>
            Welcome to Worldwide FM!
          </h2>
          <p className='text-white/90 text-lg mb-8 max-w-2xl mx-auto'>
            Your membership subscription is being processed. You'll receive a confirmation email
            shortly.
          </p>
          <Link href='/dashboard'>
            <Button className='bg-almostblack text-white hover:bg-almostblack/90'>
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleJoinClick = async () => {
    if (!user && !showForm) {
      setShowForm(true);
      return;
    }

    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || `Server error: ${response.status}`);
        setIsProcessing(false);
        return;
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setIsProcessing(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('No checkout URL returned from server');
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Membership signup error:', err);
      setError(err.message || 'Network error. Please check your connection and try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className='min-h-screen w-screen flex items-center justify-center relative overflow-hidden'>
      {/* Background layers */}
      <div className='absolute inset-0 bg-soul-200' />
      <div
        className='absolute inset-0 bg-gradient-to-b from-white via-white/0 to-white'
        style={{ mixBlendMode: 'hue' }}
      />
      <div
        className='absolute inset-0'
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '50px 50px',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Content */}
      <div className='relative z-10 text-center px-5 max-w-4xl mx-auto'>
        <h1 className='font-display mx-auto uppercase text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-8 text-white leading-tight'>
          {heading}
        </h1>
        <div
          className='text-white/90 text-base sm:text-lg leading-relaxed mb-12 max-w-[36rem] mx-auto'
          dangerouslySetInnerHTML={{ __html: body }}
        />

        {error && (
          <div className='mb-6 p-4 bg-red-500/90 text-white text-sm rounded-lg max-w-md mx-auto'>
            {error}
          </div>
        )}

        {showForm && !user ? (
          <div className='max-w-md mx-auto mb-8'>
            <div className='space-y-4 text-left bg-white/10 backdrop-blur-sm p-6 rounded-lg'>
              <div>
                <Label htmlFor='firstName' className='text-white mb-2'>
                  First Name *
                </Label>
                <Input
                  id='firstName'
                  type='text'
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder='Enter your first name'
                  className='bg-white/90 text-black'
                  required
                />
              </div>
              <div>
                <Label htmlFor='lastName' className='text-white mb-2'>
                  Last Name *
                </Label>
                <Input
                  id='lastName'
                  type='text'
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder='Enter your last name'
                  className='bg-white/90 text-black'
                  required
                />
              </div>
              <div>
                <Label htmlFor='email' className='text-white mb-2'>
                  Email *
                </Label>
                <Input
                  id='email'
                  type='email'
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder='Enter your email'
                  className='bg-white/90 text-black'
                  required
                />
              </div>
            </div>
          </div>
        ) : null}

        <Button
          onClick={handleJoinClick}
          disabled={isProcessing}
          className='bg-almostblack text-white hover:bg-almostblack/90 px-12 py-6 text-lg font-mono uppercase tracking-wider'
        >
          {isProcessing ? (
            <>
              <Loader2 className='size-4 animate-spin mr-2' />
              Processing...
            </>
          ) : (
            'JOIN NOW'
          )}
        </Button>

        {!user && !showForm && (
          <div className='mt-8 text-white/80 text-sm'>
            Already have an account?{' '}
            <Link href='/login' className='text-white hover:underline font-medium'>
              Login
            </Link>{' '}
            or{' '}
            <Link href='/signup' className='text-white hover:underline font-medium'>
              Sign up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
