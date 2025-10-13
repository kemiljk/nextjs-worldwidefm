import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { getRadioShows } from '@/lib/cosmic-service';
import { cosmic } from '@/lib/cosmic-config';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { transformShowToViewData } from '@/lib/cosmic-service';
import HostClient from './host-client';

// Revalidate frequently to show new shows quickly
export const revalidate = 60; // 1 minute

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const host = await getHostBySlug(slug);

    if (host) {
      return generateBaseMetadata({
        title: `${host.title} - Host - Worldwide FM`,
        description:
          host.metadata?.description || `Listen to shows hosted by ${host.title} on Worldwide FM.`,
        image: host.metadata?.image?.imgix_url,
        keywords: ['host', 'dj', 'presenter', 'radio', 'worldwide fm', host.title.toLowerCase()],
      });
    }

    return generateBaseMetadata({
      title: 'Host Not Found - Worldwide FM',
      description: 'The requested host could not be found.',
      noIndex: true,
    });
  } catch (error) {
    console.error('Error generating host metadata:', error);
    return generateBaseMetadata({
      title: 'Host Not Found - Worldwide FM',
      description: 'The requested host could not be found.',
      noIndex: true,
    });
  }
}

// Generate static params for all hosts
export async function generateStaticParams() {
  try {
    // Get all hosts from Cosmic CMS
    const response = await cosmic.objects
      .find({
        type: 'regular-hosts',
        status: 'published',
      })
      .props('slug')
      .limit(1000);

    const params =
      response.objects?.map((host: any) => ({
        slug: host.slug,
      })) || [];

    return params;
  } catch (error) {
    console.error('Error generating static params for hosts:', error);
    return [];
  }
}

async function getHostBySlug(slug: string) {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'regular-hosts',
        slug: slug,
      })
      .props('id,slug,title,content,metadata')
      .depth(1);

    return response?.object || null;
  } catch (error) {
    console.error(`Error fetching host by slug ${slug}:`, error);
    return null;
  }
}

async function getInitialShows(hostId: string) {
  try {
    const response = await getRadioShows({
      filters: { host: hostId },
      limit: 20, // Load initial batch of 20
      sort: '-metadata.broadcast_date',
    });

    // Transform episodes to show format for ShowCard compatibility
    const transformedShows = (response.objects || []).map(transformShowToViewData);
    return transformedShows;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error fetching initial shows for host ${hostId}:`, error);
    }
    return [];
  }
}

export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const host = await getHostBySlug(slug);

  if (!host) {
    notFound();
  }

  // Get initial shows hosted by this person
  const initialShows = await getInitialShows(host.id);

  const hostImage = host.metadata?.image?.imgix_url || '/image-placeholder.svg';
  const hostDescription = host.metadata?.description || host.content || '';

  return (
    <div className='space-y-8'>
      <Link
        href='/shows'
        className='text-foreground flex items-center gap-1'
      >
        <ChevronRight className='w-4 h-4 rotate-180' />
        Back to Shows
      </Link>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
        <div className='aspect-square relative overflow-hidden'>
          <Image
            src={hostImage}
            alt={host.title}
            fill
            className='object-cover rounded-none'
          />
        </div>

        <div>
          <PageHeader
            title={host.title}
            description={hostDescription}
          />

          {initialShows.length > 0 && (
            <div className='mt-8'>
              <h3 className='text-m5 font-mono font-normal text-almostblack dark:text-white mb-4'>
                Shows
              </h3>
              <p className='text-muted-foreground mb-4'>Recent shows hosted by {host.title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Hosted Shows with Infinite Scroll */}
      <HostClient
        hostId={host.id}
        hostTitle={host.title}
        initialShows={initialShows}
      />
    </div>
  );
}
