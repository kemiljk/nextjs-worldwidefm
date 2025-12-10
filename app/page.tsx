import React, { Suspense } from 'react';
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

// Helper function to render page order items
function renderPageOrderItem(
  item: PageOrderItem,
  colouredSections: any[],
  hasHeroItems: boolean
): React.ReactNode {
  switch (item.type) {
    case 'latest-episodes':
      return <LatestEpisodes config={item.metadata} hasHeroItems={hasHeroItems} />;

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
  const [homepageData, videosData, postsData, user] = await Promise.all([
    getCosmicHomepageData(),
    getVideos(),
    getAllPosts(),
    getAuthUser(),
  ]);

  let favoriteGenreIds: string[] = [];
  let favoriteHostIds: string[] = [];

  if (user) {
    try {
      const { data: userData } = await getUserData(user.id);
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
    } catch (error) {
      console.error('Error fetching user favorites:', error);
    }
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

              const { getEpisodes } = await import('@/lib/episode-service');

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

  // Get recent published episodes from Cosmic
  const response = await getEpisodesForShows({ limit: 20 });
  const shows = (response?.shows || []).map(show => {
    const transformed = transformShowToViewData(show);
    return {
      ...transformed,
      key: transformed.slug,
    };
  });

  // Fetch ALL genres from Cosmic
  const { getCanonicalGenres } = await import('@/lib/get-canonical-genres');
  const canonicalGenres = await getCanonicalGenres();

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

  // Fetch random shows for top genres only (for initial default view)
  // GenreSelector will fetch dynamically when a genre is selected
  const randomShowsByGenre: Record<string, any> = {};
  const topGenresToPreload = topGenres.slice(0, 5); // Only preload top 5 genres

  // Process top genres sequentially (not in parallel) to avoid timeouts
  for (const genreTitle of topGenresToPreload) {
    try {
      const canonicalGenre = canonicalGenres.find(
        g => g.title.toLowerCase() === genreTitle.toLowerCase()
      );

      if (!canonicalGenre) continue;

      // Fetch with timeout protection
      const fetchWithTimeout = Promise.race([
        getEpisodesForShows({
          genre: [canonicalGenre.id],
          random: true,
          limit: 1,
        }).catch(err => {
          // Handle 404s gracefully - genres with no episodes are expected
          const is404 =
            err?.status === 404 ||
            err?.message?.includes('404') ||
            err?.message?.includes('No objects found');
          if (!is404) {
            throw err;
          }
          return { shows: [], total: 0, hasNext: false };
        }),
        new Promise<{ shows: any[] }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);

      const randomResponse = await fetchWithTimeout;

      if (randomResponse?.shows && randomResponse.shows.length > 0) {
        const transformed = transformShowToViewData(randomResponse.shows[0]);
        randomShowsByGenre[genreTitle] = {
          ...transformed,
          key: transformed.slug,
        };
      }
    } catch (error: any) {
      // Silently fail for individual genres (404s are expected for genres with no episodes)
      const is404 =
        error?.status === 404 ||
        error?.message?.includes('404') ||
        error?.message?.includes('No objects found');
      if (process.env.NODE_ENV === 'development' && !is404) {
        console.debug(`Failed to fetch random show for genre ${genreTitle}:`, error);
      }
    }
  }

  // Get shows from the archive - use offset instead of random for better performance
  let archiveShowsRaw: any[] = [];
  try {
    // Pick a random offset between 50-200 to get varied older episodes
    const randomOffset = Math.floor(Math.random() * 150) + 50;
    const archiveResponse = await getEpisodesForShows({ limit: 20, offset: randomOffset });
    archiveShowsRaw = archiveResponse.shows || [];
  } catch (error) {
    console.error('Error fetching archive shows:', error);
  }
  const archiveShows = archiveShowsRaw.map(show => {
    const transformed = transformShowToViewData(show);
    return {
      ...transformed,
      key: transformed.slug,
    };
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
        {pageOrder.map((item, index) => (
          <Suspense key={`${item.type}-${item.id}-${index}`} fallback={<div>Loading...</div>}>
            {renderPageOrderItem(
              item,
              colouredSections,
              !!(displayHeroItems && heroLayout && heroItems.length > 0)
            )}
          </Suspense>
        ))}

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
