'use client';

import { useState } from 'react';
import { Button } from '@/cosmic/elements/Button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/cosmic/elements/Input';
import { Label } from '@/cosmic/elements/Label';

interface ResetPasswordFormProps {
  token: string;
  onSubmit: (token: string, formData: FormData) => Promise<any>;
}

export default function ResetPasswordForm({ token, onSubmit }: ResetPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData(e.currentTarget);
      const password = formData.get('password') as string;
      const confirmPassword = formData.get('confirmPassword') as string;

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      const result = await onSubmit(token, formData);

      if (result && result.error) {
        setError(result.error);
        return;
      }

      // Redirect to login with success message
      router.push('/login?success=Password reset successful. Please login with your new password.');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='py-8'>
      <div className='mx-auto max-w-md'>
        <div className='bg-card p-8 shadow-xs'>
          <h1 className='font-display uppercase text-3xl font-normal tracking-tight text-center mb-8'>
            Reset Your Password
          </h1>

          {error && (
            <div className='mb-6 p-4 bg-crimson-50 border border-crimson-200 text-crimson-800 text-sm'>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='password'>New Password</Label>
              <Input
                type='password'
                id='password'
                name='password'
                required
                minLength={8}
                placeholder='Enter your new password'
              />
              <p className='text-xs text-muted-foreground'>
                Password must be at least 8 characters long and contain both letters and numbers
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='confirmPassword'>Confirm Password</Label>
              <Input
                type='password'
                id='confirmPassword'
                name='confirmPassword'
                required
                minLength={8}
                placeholder='Confirm your new password'
              />
            </div>

            <Button type='submit' disabled={isLoading} className='w-full'>
              {isLoading ? <Loader2 className='size-4 animate-spin' /> : 'Reset Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
