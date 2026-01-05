import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { connection } from 'next/server';
import {
  getCosmicHomepageData,
  fetchCosmicObjectById,
  getVideos,
  getAllPosts,
  createColouredSections,
} from '@/lib/actions';
import { generateHomepageMetadata } from '@/lib/metadata-utils';
import { getEpisodesForShows, getEpisodeBySlug, getEpisodes } from '@/lib/episode-service';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import EditorialSection from '@/components/editorial/editorial-section';
import VideoSection from '@/components/video/video-section';
import ArchiveSection from '@/components/archive/archive-section';
import GenreSelector from '@/components/genre-selector';
import FeaturedSections from '@/components/featured-sections';
import { PageOrderItem } from '@/lib/cosmic-types';
import HomepageHero from '@/components/homepage-hero';
import LatestEpisodes from '@/components/latest-episodes';
import ColouredSectionGallery from '@/components/coloured-section-gallery';
import MembershipPromoSection from '@/components/membership-promo-section';
import { ShowCard } from '@/components/ui/show-card';
import { ForYouSection } from '@/components/for-you-section';
import { getAuthUser, getUserData } from '@/cosmic/blocks/user-management/actions';
import { ShowsGridSkeleton } from '@/components/shows-grid-skeleton';

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

// Helper function to render page order items (sync only - async components handled separately)
function renderPageOrderItem(
  item: PageOrderItem,
  colouredSections: any[],
  hasHeroItems: boolean
): React.ReactNode {
  switch (item.type) {
    case 'latest-episodes':
      // Async component - handled separately in the main render
      return null;

    case 'sections':
      const sectionType = item.metadata?.type;
      const items = item.metadata?.items || [];
      const sectionTitle = item.title;

      // Determine the content type based on items
      if (items.length > 0) {
        const firstItem = items[0];
        const itemType = firstItem.type;

        // For Editorial/Video posts, use EditorialSection
        if (itemType === 'posts') {
          return (
            <EditorialSection
              posts={items}
              title={sectionTitle}
              className='pt-8'
              isHomepage={true}
            />
          );
        }

        // For Shows/Episodes, use ShowsGrid
        if (itemType === 'episodes') {
          return (
            <section className='py-8 px-5'>
              <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight uppercase'>
                {sectionTitle}
              </h2>
              <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
                {items.map((show: any, index: number) => {
                  const transformed = transformShowToViewData(show);
                  return (
                    <ShowCard
                      key={show.id || show.slug || index}
                      show={{
                        ...transformed,
                        url: show.metadata?.player
                          ? show.metadata.player.startsWith('http')
                            ? show.metadata.player
                            : `https://www.mixcloud.com${show.metadata.player}`
                          : '',
                        key: show.slug,
                      }}
                      slug={`/episode/${show.slug}`}
                      playable
                    />
                  );
                })}
              </div>
            </section>
          );
        }

        // For Archive, use ArchiveSection or ShowsGrid
        if (sectionType === 'Archive') {
          return <ArchiveSection shows={items} className='pt-8' />;
        }
      }

      return null;

    case 'membership-promo':
      return <MembershipPromoSection config={item.metadata} />;

    case 'coloured-sections':
      // Render carousel of coloured sections
      // Note: colouredSections are pre-processed in the main Home component
      return <ColouredSectionGallery colouredSections={colouredSections} homepageData={item} />;

    default:
      return null;
  }
}

export default async function Home() {
  // Opt into dynamic rendering - ensures Cosmic changes show instantly
  await connection();

  // Parallel fetch all initial data in a single Promise.all
  const [homepageData, videosData, postsData, user, canonicalGenres, recentEpisodesResponse] =
    await Promise.all([
      getCosmicHomepageData(),
      getVideos(),
      getAllPosts(),
      getAuthUser(),
      getCanonicalGenres(),
      getEpisodesForShows({ limit: 20 }),
    ]);

  // Transform recent episodes once
  const shows = (recentEpisodesResponse?.shows || []).map(show => {
    const transformed = transformShowToViewData(show);
    return {
      ...transformed,
      key: transformed.slug,
    };
  });

  // Fetch user data in parallel if user exists (non-blocking)
  const userDataPromise = user
    ? getUserData(user.id).catch(() => ({ data: null }))
    : Promise.resolve({ data: null });

  let favoriteGenreIds: string[] = [];
  let favoriteHostIds: string[] = [];

  const { data: userData } = await userDataPromise;
  if (userData?.metadata?.favourite_genres) {
    favoriteGenreIds = userData.metadata.favourite_genres
      .map((g: any) => (typeof g === 'string' ? g : g.id))
      .filter(Boolean);
  }
  if (userData?.metadata?.favourite_hosts) {
    favoriteHostIds = userData.metadata.favourite_hosts
      .map((h: any) => (typeof h === 'string' ? h : h.id))
      .filter(Boolean);
  }

  const hasFavorites = favoriteGenreIds.length > 0 || favoriteHostIds.length > 0;

  // Get page order from Cosmic
  const pageOrder = homepageData?.metadata?.page_order || [];

  // Process coloured sections from page_order items (NEW structure)
  const colouredSectionItems = pageOrder.filter(item => item.type === 'coloured-sections');
  let colouredSections: any[] = [];

  if (colouredSectionItems.length > 0) {
    // Process coloured sections from page_order with timeout protection
    const allSections = await Promise.allSettled(
      colouredSectionItems.flatMap(item => {
        const sectionData = item.metadata?.coloured_section || [];
        return sectionData.map(async (section: any, idx: number) => {
          // Color mapping from Cosmic color names to hex values
          const colorMap: Record<string, string> = {
            Orange: '#f8971d',
            Green: '#88ca4f',
            Pink: '#e661a4',
            Blue: '#1da0f8',
          };

          try {
            let shows: any[] = [];

            if (section.show_type) {
              // Extract ID from show_type object if it's an object, otherwise use as-is
              const showTypeId =
                typeof section.show_type === 'object' && section.show_type?.id
                  ? section.show_type.id
                  : section.show_type;

              // Add timeout protection
              const fetchWithTimeout = Promise.race([
                getEpisodes({
                  showType: [showTypeId],
                  limit: 10,
                }),
                new Promise<{ episodes: any[] }>((_, reject) =>
                  setTimeout(() => reject(new Error('Timeout')), 6000)
                ),
              ]);

              const episodes = await fetchWithTimeout;

              shows = (episodes.episodes || []).map((episode: any) => {
                const transformed = transformShowToViewData(episode);
                return {
                  ...transformed,
                  key: transformed.slug,
                };
              });
            }

            // Get color from section.colour or show_type metadata
            const colorName =
              section.colour || section.show_type?.metadata?.colour?.value || 'Orange';
            const backgroundColor = colorMap[colorName] || '#f8971d';

            return {
              title: section.title,
              type: 'Shows',
              layout: 'Unique',
              is_active: true,
              description: section.description,
              time: section.time,
              items: shows,
              color: backgroundColor,
            };
          } catch (error) {
            console.error(`Error processing coloured section ${section.title}:`, error);
            return null;
          }
        });
      })
    );

    // Extract successful sections only
    colouredSections = allSections
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<any>).value);
  } else {
    // Fallback to OLD structure - if homepageData is null or doesn't have the expected structure,
    // colouredSections will remain an empty array
    if (
      homepageData?.metadata?.coloured_sections &&
      Array.isArray(homepageData.metadata.coloured_sections)
    ) {
      try {
        // Only process if we have the expected ProcessedHomepageSection[] format
        const sections = homepageData.metadata.coloured_sections as any;
        if (sections.length > 0 && sections[0]?.items && sections[0]?.layout) {
          colouredSections = await createColouredSections(sections);
        }
      } catch (error) {
        console.error('Error processing old coloured sections format:', error);
      }
    }
  }

  // Get top genres from recent shows for initial default view
  const genreCounts = shows.reduce(
    (acc, episode) => {
      const genres = episode.genres || episode.metadata?.genres || [];
      genres.forEach((genre: any) => {
        const genreTitle = genre.title || genre.name;
        if (genreTitle && genreTitle.toLowerCase() !== 'worldwide fm') {
          acc[genreTitle] = (acc[genreTitle] || 0) + 1;
        }
      });
      return acc;
    },
    {} as Record<string, number>
  );

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name]) => name);

  // Fetch random shows for top genres AND archive shows in parallel
  const topGenresToPreload = topGenres.slice(0, 5);
  const randomOffset = Math.floor(Math.random() * 150) + 50;

  // Build parallel fetch promises for genres
  const genrePromises = topGenresToPreload.map(async genreTitle => {
    const canonicalGenre = canonicalGenres.find(
      g => g.title.toLowerCase() === genreTitle.toLowerCase()
    );
    if (!canonicalGenre) return { genreTitle, show: null };

    try {
      const response = await Promise.race([
        getEpisodesForShows({
          genre: [canonicalGenre.id],
          random: true,
          limit: 1,
        }).catch(() => ({ shows: [], total: 0, hasNext: false })),
        new Promise<{ shows: any[] }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);

      if (response?.shows?.[0]) {
        const transformed = transformShowToViewData(response.shows[0]);
        return { genreTitle, show: { ...transformed, key: transformed.slug } };
      }
    } catch {
      // Silently fail for individual genres
    }
    return { genreTitle, show: null };
  });

  // Fetch archive shows promise
  const archivePromise = getEpisodesForShows({ limit: 20, offset: randomOffset }).catch(() => ({
    shows: [],
  }));

  // Execute all in parallel
  const [genreResults, archiveResponse] = await Promise.all([
    Promise.all(genrePromises),
    archivePromise,
  ]);

  // Build randomShowsByGenre from parallel results
  const randomShowsByGenre: Record<string, any> = {};
  for (const { genreTitle, show } of genreResults) {
    if (show) randomShowsByGenre[genreTitle] = show;
  }

  // Transform archive shows
  const archiveShows = (archiveResponse.shows || []).map(show => {
    const transformed = transformShowToViewData(show);
    return { ...transformed, key: transformed.slug };
  });

  const displayHeroItems = homepageData?.metadata?.display_hero_items ?? false;
  const heroLayout = homepageData?.metadata?.heroLayout;
  const heroItemsRaw = homepageData?.metadata?.heroItems || [];

  // Fetch full episode data for hero items only if display_hero_items is enabled
  const heroItems = displayHeroItems
    ? (
        await Promise.all(
          heroItemsRaw
            .filter(item => item.type === 'episode')
            .map(async item => {
              try {
                const fullEpisode = await getEpisodeBySlug(item.slug);
                if (fullEpisode) {
                  const transformed = transformShowToViewData(fullEpisode);
                  return {
                    ...transformed,
                    key: transformed.slug,
                    url: transformed.url,
                  };
                }
              } catch (error) {
                console.error(`Error fetching hero episode ${item.slug}:`, error);
              }

              const playerUrl = item.metadata?.player as unknown as string | undefined;
              return {
                ...item,
                key: item.slug,
                url: playerUrl
                  ? playerUrl.startsWith('http')
                    ? playerUrl
                    : `https://www.mixcloud.com${playerUrl}`
                  : '',
              };
            })
        )
      ).filter(Boolean)
    : [];

  // Check if sections are in page_order (new system) or should use old system
  const hasColouredSectionsInOrder = pageOrder.some(item => item.type === 'coloured-sections');

  return (
    <div className='w-full min-h-screen'>
      <div className='mt-8 mb-12'>
        {/* Hero Section */}
        {displayHeroItems && heroLayout && heroItems.length > 0 && (
          <Suspense>
            <HomepageHero heroLayout={heroLayout} heroItems={heroItems} />
          </Suspense>
        )}

        {/* Only show FeaturedSections if heroItems are not displayed */}
        {!(displayHeroItems && heroLayout && heroItems.length > 0) && (
          <Suspense>
            <FeaturedSections shows={shows.slice(0, 2)} />
          </Suspense>
        )}

        {/* For You Section - Only show if user is logged in and has favorites */}
        {hasFavorites && (
          <Suspense
            fallback={
              <section className='py-8 px-5'>
                <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight'>FOR YOU</h2>
                <ShowsGridSkeleton count={15} />
              </section>
            }
          >
            <ForYouSection
              favoriteGenreIds={favoriteGenreIds}
              favoriteHostIds={favoriteHostIds}
              limit={15}
            />
          </Suspense>
        )}

        {/* Coloured Sections - use page_order if available, otherwise hardcoded */}
        {!hasColouredSectionsInOrder && (
          <Suspense>
            <ColouredSectionGallery
              colouredSections={colouredSections}
              homepageData={homepageData}
            />
          </Suspense>
        )}

        {/* Dynamic page order rendering - ONLY render sections that ARE in page_order */}
        {pageOrder.map((item, index) => {
          const hasHeroItemsFlag = !!(displayHeroItems && heroLayout && heroItems.length > 0);

          // Handle async LatestEpisodes component directly (not through sync helper)
          if (item.type === 'latest-episodes') {
            return (
              <Suspense
                key={`${item.type}-${item.id}-${index}`}
                fallback={<ShowsGridSkeleton count={10} />}
              >
                <LatestEpisodes config={item.metadata} hasHeroItems={hasHeroItemsFlag} />
              </Suspense>
            );
          }

          return (
            <Suspense key={`${item.type}-${item.id}-${index}`} fallback={<div>Loading...</div>}>
              {renderPageOrderItem(item, colouredSections, hasHeroItemsFlag)}
            </Suspense>
          );
        })}

        {/* From The Archive Section */}
        {archiveShows.length > 0 && <ArchiveSection shows={archiveShows} className='pt-8' />}

        {/* Genre Selector Section */}
        <Suspense>
          <GenreSelector
            shows={shows}
            randomShowsByGenre={randomShowsByGenre}
            allCanonicalGenres={canonicalGenres}
          />
        </Suspense>

        {/* Video Section */}
        {videosData.videos.length > 0 && (
          <VideoSection videos={videosData.videos} className='pt-8' />
        )}

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
