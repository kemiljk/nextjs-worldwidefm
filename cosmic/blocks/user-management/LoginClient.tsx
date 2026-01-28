'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import AuthForm from '@/cosmic/blocks/user-management/AuthForm';
import { Loader2 } from 'lucide-react';

export default function LoginClient({ onSubmit, redirect }: { onSubmit: any; redirect: string }) {
  const { user, isLoading, login: authLogin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const redirectParam = searchParams.get('redirect');
  const finalRedirect = redirectParam || redirect;

  useEffect(() => {
    if (!isLoading && user) {
      router.push(finalRedirect);
      router.refresh();
    }
  }, [user, isLoading, router, finalRedirect]);

  if (isLoading) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center p-4'>
        <Loader2 className='size-8 animate-spin text-primary' />
      </div>
    );
  }

  return (
    <div className='py-8'>
      {success && (
        <div className='mx-auto max-w-md mb-6 p-4 bg-green-50 border border-green-200 text-green-800 text-sm'>
          {success}
        </div>
      )}
      {error && (
        <div className='mx-auto max-w-md mb-6 p-4 bg-crimson-50 border border-crimson-200 text-crimson-800 text-sm'>
          {error}
        </div>
      )}
      <AuthForm
        type='login'
        onSubmit={async formData => {
          const result = await onSubmit(formData);
          if (result && result.error) {
            router.push(`/login?error=${encodeURIComponent(result.error)}`);
            return result;
          } else if (result && result.user) {
            authLogin(result.user);
            return result;
          }
        }}
      />
    </div>
  );
}
