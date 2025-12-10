import { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { getVideos, getVideoCategories, getVideosPageConfig } from '@/lib/actions';
import VideosClient from './videos-client';
import { generateVideosMetadata } from '@/lib/metadata-utils';

export const revalidate = 300; // 5 minutes - videos change infrequently

export const generateMetadata = async (): Promise<Metadata> => {
  return generateVideosMetadata();
};

export default async function VideosPage() {
  const [videos, videoCategories, pageConfig] = await Promise.all([
    getVideos({ limit: 50 }),
    getVideoCategories(),
    getVideosPageConfig(),
  ]);

  // Extract category order from page config
  const categoryOrder = pageConfig?.category_order || [];

  return (
    <div className='w-full overflow-x-hidden'>
      {/* Header */}
      <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
        <div className='absolute inset-0 bg-soul' />
        <div
          className='absolute inset-0 bg-gradient-to-b from-white via-white/0 to-white'
          style={{ mixBlendMode: 'hue' }}
        />
        <div
          className='absolute inset-0'
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '50px 50px',
            mixBlendMode: 'screen',
          }}
        />
        <div className='absolute bottom-0 left-0 w-full px-5 z-10'>
          <PageHeader title='Videos' />
        </div>
      </div>

      {/* Content */}
      <div className='px-5 pb-20 font-mono uppercase text-m8'>
        <Suspense fallback={<div>Loading...</div>}>
          <VideosClient 
            initialVideos={videos.videos} 
            availableCategories={videoCategories}
            categoryOrder={categoryOrder}
          />
        </Suspense>
      </div>
    </div>
  );
}
