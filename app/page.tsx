import { Suspense } from 'react';
import { Metadata } from 'next';
import {
  getCosmicHomepageData,
  fetchCosmicObjectById,
  getVideos,
  getAllPosts,
  createColouredSections,
} from '@/lib/actions';
import { generateHomepageMetadata } from '@/lib/metadata-utils';
import { getEpisodesForShows, getEpisodeBySlug } from '@/lib/episode-service';
import { transformShowToViewData } from '@/lib/cosmic-service';
import EditorialSection from '@/components/editorial/editorial-section';
import VideoSection from '@/components/video/video-section';
import ArchiveSection from '@/components/archive/archive-section';
// Removed date-fns imports as they're no longer needed with simplified FeaturedSections
import GenreSelector from '@/components/genre-selector';
import FeaturedSections from '@/components/featured-sections';
import { HomepageSectionItem, ProcessedHomepageSection } from '@/lib/cosmic-types';
import HomepageHero from '@/components/homepage-hero';
import InsertedSection from '@/components/inserted-section';
import LatestEpisodes from '@/components/latest-episodes';
import ColouredSectionGallery from '@/components/coloured-section-gallery';

// Revalidate frequently to show new shows quickly
export const revalidate = 60; // 1 minute

// Generate metadata for the homepage
export async function generateMetadata(): Promise<Metadata> {
  try {
    const homepageData = await getCosmicHomepageData();
    return generateHomepageMetadata(homepageData);
  } catch (error) {
    console.error('Error generating metadata:', error);
    return generateHomepageMetadata();
  }
}

export default async function Home() {
  const [homepageData, videosData, postsData] = await Promise.all([
    getCosmicHomepageData(),
    getVideos(),
    getAllPosts(),
  ]);

  // Create coloured sections from homepage data
  const colouredSections = await createColouredSections(homepageData);

  // Get recent published episodes from Cosmic (already sorted newest-first server-side)
  const response = await getEpisodesForShows({ limit: 20 });
  const shows = (response?.shows || []).map((show) => {
    // Transform using the same function as other components
    const transformed = transformShowToViewData(show);
    return {
      ...transformed,
      key: transformed.slug, // Add key for media player identification
    };
  });

  // Removed getCurrentShow function and mostRecentShow variable as they're no longer needed with simplified FeaturedSections

  // Get shows from the archive
  const { shows: archiveShowsRaw } = await getEpisodesForShows({ random: true, limit: 20 });
  const archiveShows = archiveShowsRaw.map((show) => {
    // Transform using the same function as other components
    const transformed = transformShowToViewData(show);
    return {
      ...transformed,
      key: transformed.slug, // Add key for media player identification
    };
  });

  const heroLayout = homepageData?.metadata?.heroLayout;
  const heroItemsRaw = homepageData?.metadata?.heroItems || [];

  // Fetch full episode data for hero items (similar to dynamic sections)
  const heroItems = await Promise.all(
    heroItemsRaw
      .filter((item) => item.type === 'episodes') // Only process episodes
      .map(async (item) => {
        try {
          // Fetch the full episode data
          const fullEpisode = await getEpisodeBySlug(item.slug);
          if (fullEpisode) {
            // Transform using the same function as other components
            const transformed = transformShowToViewData(fullEpisode);
            return {
              ...transformed,
              key: transformed.slug,
              url: transformed.url,
            } as any; // Cast to any to avoid type issues
          }
        } catch (error) {
          console.error(`Error fetching hero episode ${item.slug}:`, error);
        }
        // Fallback to original item if fetch fails
        const playerUrl = item.metadata?.player as unknown as string | undefined;
        return {
          ...item,
          key: item.slug,
          url: playerUrl
            ? playerUrl.startsWith('http')
              ? playerUrl
              : `https://www.mixcloud.com${playerUrl}`
            : '',
        } as any; // Cast to any to avoid type issues
      })
  );

  // Process dynamic sections to fetch full item data
  const rawDynamicSections = homepageData?.metadata?.sections || [];
  const processedDynamicSections: ProcessedHomepageSection[] = await Promise.all(
    rawDynamicSections
      .filter(section => section.is_active && section.items && section.items.length > 0)
      .map(async section => {
        const fetchedItemsPromises = section.items
          .map((item: any) => {
            let id: string = '';
            if (typeof item === 'string') {
              id = item;
            } else if (
              item &&
              typeof item === 'object' &&
              'id' in item &&
              typeof item.id === 'string'
            ) {
              id = item.id;
            }
            return id;
          })
          .filter(id => id && id.length > 0)
          .map(id => fetchCosmicObjectById(id));

        const fetchedItems = (await Promise.all(fetchedItemsPromises)).filter(
          Boolean
        ) as HomepageSectionItem[];
        return {
          ...section,
          layout: section.layout || 'Grid',
          items: fetchedItems,
        };
      })
  );

  return (
    <div className='w-full min-h-screen'>
      {/* Main content */}
      <div className='mt-4 mb-12'>
        {/* Hero Section: Conditionally render based on Cosmic data or fallback */}
        <Suspense>
          {heroLayout && <HomepageHero heroLayout={heroLayout} heroItems={heroItems} />}
        </Suspense>
        <Suspense>
          <FeaturedSections shows={shows.slice(0, 2)} />
        </Suspense>

        <Suspense>
          <LatestEpisodes />
        </Suspense>

        {/* Coloured Sections: horizontal swipe gallery (CSS-only, no client hooks) */}
        <Suspense>
          <ColouredSectionGallery colouredSections={colouredSections} homepageData={homepageData} />
        </Suspense>

        {/* Static sections stacked below */}
        {processedDynamicSections.map((section, index) => (
          <Suspense key={`static-${section.title}-${index}`} fallback={<div>Loading...</div>}>
            <InsertedSection section={section} />
          </Suspense>
        ))}
        {/* From The Archive Section */}
        {archiveShows.length > 0 && <ArchiveSection shows={archiveShows} className='pt-8' />}
        {/* Genre Selector Section */}
        <Suspense>
          <GenreSelector shows={shows} />
        </Suspense>

        {/* Video Section */}
        {videosData.videos.length > 0 && (
          <VideoSection videos={videosData.videos} className='pt-8' />
        )}

        {/* Editorial section */}
        {postsData.posts.length > 0 && (
          <EditorialSection
            posts={postsData.posts}
            title='Editorial'
            className='pt-8'
            isHomepage={true}
          />
        )}
      </div>
    </div>
  );
}
