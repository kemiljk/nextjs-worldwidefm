import { Suspense } from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import DashboardClient from '@/cosmic/blocks/user-management/DashboardClient';
import { getAuthUser, getDashboardData } from '@/cosmic/blocks/user-management/actions';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Dashboard - Worldwide FM',
    description: 'Manage your Worldwide FM account, preferences, and favorites.',
    noIndex: true,
  });
};

async function DashboardContent({ userId }: { userId: string }) {
  // Fetch all dashboard data server-side
  const { data, error } = await getDashboardData(userId);

  if (error || !data) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-red-500 mb-4'>Error Loading Dashboard</h1>
          <p className='text-gray-600'>{error || 'Failed to load dashboard data'}</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardClient
      userData={data.userData}
      allGenres={data.allGenres}
      allHosts={data.allHosts}
      canonicalGenres={data.canonicalGenres}
      favouriteGenres={data.favouriteGenres}
      favouriteHosts={data.favouriteHosts}
    />
  );
}

export default async function DashboardPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className='container mx-auto py-8 px-4'>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={user.id} />
      </Suspense>
    </div>
  );
}
