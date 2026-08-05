import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { getEditorialLandingData } from '@/lib/editorial-page-data';
import { FilterItem as BaseFilterItem } from '@/lib/filter-types';
import EditorialClient from './editorial-client';

type FilterItem = BaseFilterItem;

function buildAvailableFilters(categoriesData: unknown[]) {
  const categories = (
    categoriesData as Array<{
      id: string;
      title: string;
      slug: string;
      content?: string;
      status?: string;
      created_at: string;
      metadata?: unknown;
    }>
  )
    .map(cat => ({
      id: cat.id,
      title: cat.title,
      slug: cat.slug,
      type: 'category',
      content: cat.content || '',
      status: cat.status || 'published',
      created_at: cat.created_at,
      metadata: cat.metadata,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    article: [
      {
        id: 'article',
        title: 'Article',
        slug: 'article',
        type: 'type',
        content: '',
        status: 'published',
        created_at: '1970-01-01T00:00:00.000Z',
        metadata: null,
      },
    ],
    video: [
      {
        id: 'video',
        title: 'Video',
        slug: 'video',
        type: 'type',
        content: '',
        status: 'published',
        created_at: '1970-01-01T00:00:00.000Z',
        metadata: null,
      },
    ],
    categories,
  } satisfies Record<string, FilterItem[]> & {
    article: FilterItem[];
    video: FilterItem[];
    categories: FilterItem[];
  };
}

function EditorialPageHeader() {
  return (
    <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
      <div className='absolute inset-0 bg-sunset' />
      <div
        className='absolute inset-0 bg-linear-to-b from-white via-white/0 to-white'
        style={{ mixBlendMode: 'hue' }}
      />
      <div
        className='absolute inset-0'
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          mixBlendMode: 'screen',
        }}
      />
      <div className='absolute bottom-0 left-0 w-full px-5 z-10'>
        <PageHeader title='editorial' />
      </div>
    </div>
  );
}

export default async function EditorialPage() {
  const { categories, categoryOrder, featuredPost, posts, total } = await getEditorialLandingData();
  const availableFilters = buildAvailableFilters(categories);

  return (
    <div className='min-h-screen'>
      <div className='w-full overflow-x-hidden mb-20'>
        <EditorialPageHeader />

        <Suspense>
          <EditorialClient
            initialPosts={posts}
            initialFeaturedPost={featuredPost}
            initialTotal={total}
            initialAvailableFilters={availableFilters}
            initialCategoryOrder={categoryOrder}
          />
        </Suspense>
      </div>
    </div>
  );
}
