import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { connection } from 'next/server';
import {
  getCosmicHomepageData,
  getVideos,
  getAllPosts,
  createColouredSections,
} from '@/lib/actions';
import { generateHomepageMetadata } from '@/lib/metadata-utils';
import { getEpisodesForShows, getEpisodeBySlug, getEpisodes } from '@/lib/episode-service';
import { toShowCardData as transformShowToViewData } from '@/lib/show-card-data';
import { getCachedGenres as getCanonicalGenres } from '@/lib/cached-data';
import EditorialSection from '@/components/editorial/editorial-section';
import VideoSection from '@/components/video/video-section';
import ArchiveSection from '@/components/archive/archive-section';
import GenreSelector from '@/components/genre-selector';
import FeaturedSections from '@/components/featured-sections';
import { PageOrderItem } from '@/lib/cosmic-types';
import HomepageHero from '@/components/homepage-hero';
import LatestEpisodes from '@/components/latest-episodes';
import UpcomingEpisodes from '@/components/upcoming-episodes';
import ColouredSectionGallery from '@/components/coloured-section-gallery';
import MembershipPromoSection from '@/components/membership-promo-section';
import { ShowCard } from '@/components/ui/show-card';
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

// Page-level data the synchronous block renderer needs in scope so that
// auto-generated blocks (archive, genre selector, video, editorial) can be
// positioned anywhere in page_order.
interface HomepageRenderContext {
  colouredSections: any[];
  archiveShows: any[];
  videos: any[];
  posts: any[];
  genreSelector: {
    shows: any[];
    randomShowsByGenre: Record<string, any>;
    allCanonicalGenres: any[];
  };
}

// Render a curated grid of episodes/shows.
function renderShowsGrid(title: string, items: any[]): React.ReactNode {
  return (
    <section className='py-8 px-5'>
      <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight uppercase'>{title}</h2>
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

function renderGenreSelector(ctx: HomepageRenderContext): React.ReactNode {
  return (
    <GenreSelector
      shows={ctx.genreSelector.shows}
      randomShowsByGenre={ctx.genreSelector.randomShowsByGenre}
      allCanonicalGenres={ctx.genreSelector.allCanonicalGenres}
    />
  );
}

// Helper function to render page order items (sync only - async components handled separately)
function renderPageOrderItem(item: PageOrderItem, ctx: HomepageRenderContext): React.ReactNode {
  switch (item.type) {
    case 'latest-episodes':
      // Async component - handled separately in the main render
      return null;

    case 'sections': {
      const items = item.metadata?.items || [];
      const sectionTitle = item.title;
      if (items.length === 0) return null;

      // Prefer the editor's explicit section type; fall back to inferring from
      // the first item's object type. Object types are singular ("episode",
      // "post", "video") so we normalise both singular and plural forms.
      const explicitType = (item.metadata?.type || '').toLowerCase();
      const firstItemType = (items[0]?.type || '').toLowerCase();

      const isArchive = explicitType === 'archive';
      const isVideos =
        explicitType === 'videos' || firstItemType === 'video' || firstItemType === 'videos';
      const isEditorial =
        explicitType === 'editorial' || firstItemType === 'post' || firstItemType === 'posts';
      const isShows =
        explicitType === 'shows' || firstItemType === 'episode' || firstItemType === 'episodes';

      // Archive items are episodes too, so check the explicit Archive type first.
      if (isArchive) {
        return <ArchiveSection shows={items} className='pt-8' />;
      }
      if (isVideos) {
        return (
          <VideoSection videos={items.slice(0, 3)} title={sectionTitle} className='pt-8' curated />
        );
      }
      if (isEditorial) {
        return (
          <EditorialSection
            posts={items.slice(0, 3)}
            title={sectionTitle}
            className='pt-8'
            isHomepage={true}
          />
        );
      }
      if (isShows) {
        return renderShowsGrid(sectionTitle, items);
      }
      return null;
    }

    case 'membership-promo':
      return <MembershipPromoSection config={item.metadata} />;

    case 'coloured-sections':
      // Render carousel of coloured sections
      // Note: colouredSections are pre-processed in the main Home component
      return (
        <ColouredSectionGallery
          colouredSections={ctx.colouredSections}
          homepageData={{ metadata: { coloured_sections: item.metadata?.coloured_sections } }}
        />
      );

    case 'genre-selector':
      return renderGenreSelector(ctx);

    case 'archive-block':
      return ctx.archiveShows.length > 0 ? (
        <ArchiveSection shows={ctx.archiveShows} className='pt-8' />
      ) : null;

    case 'video-block':
      return ctx.videos.length > 0 ? <VideoSection videos={ctx.videos} className='pt-8' /> : null;

    case 'editorial-block':
      return ctx.posts.length > 0 ? (
        <EditorialSection posts={ctx.posts} title='Editorial' className='pt-8' isHomepage={true} />
      ) : null;

    default:
      return null;
  }
}

export default async function Home() {
  await connection();

  // Public data remains shared; each response renders its own streaming boundaries.
  // Content updates via revalidation or manual trigger at /api/revalidate

  // Parallel fetch all initial data in a single Promise.all
  const [homepageData, videosData, postsData, canonicalGenres, recentEpisodesResponse] =
    await Promise.all([
      getCosmicHomepageData(),
      getVideos({ limit: 3 }),
      getAllPosts({ limit: 3 }),
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

  // Get page order from Cosmic
  const pageOrder = homepageData?.metadata?.page_order || [];

  // Process coloured sections from page_order items (NEW structure)
  const colouredSectionItems = pageOrder.filter(item => item.type === 'coloured-sections');
  let colouredSections: any[] = [];

  if (colouredSectionItems.length > 0) {
    // Preserve the previous cached page if a section refresh fails.
    const allSections = await Promise.all(
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

              const episodes = await getEpisodes({ showType: [showTypeId], limit: 10 });

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
            throw error;
          }
        });
      })
    );

    // Extract successful sections only
    colouredSections = allSections.filter(Boolean);
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
        throw error;
      }
    }
  }

  // Get top genres from recent shows for initial default view
  const noise = new Set([
    'worldwide fm',
    'show',
    'episode',
    'radio',
    'wwfm',
    'archive',
    'recorded',
    'live',
    'mix',
    'radio show',
    'guest mix',
    'recorded live',
  ]);
  const genreCounts = shows.reduce(
    (acc, episode) => {
      const genres = episode.genres || [];
      genres.forEach((genre: any) => {
        const genreTitle = genre.title || genre.name;
        if (genreTitle && !noise.has(genreTitle.toLowerCase())) {
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
  // One archive selection per UTC day keeps the upstream cache key bounded.
  const randomOffset = (Math.floor(Date.now() / 86400000) % 150) + 50;

  // Build parallel fetch promises for genres
  const genrePromises = topGenresToPreload.map(async genreTitle => {
    const canonicalGenre = canonicalGenres.find(
      g => g.title.toLowerCase() === genreTitle.toLowerCase()
    );
    if (!canonicalGenre) return { genreTitle, show: null };

    try {
      const response = await getEpisodesForShows({
        genre: [canonicalGenre.id],
        random: true,
        limit: 1,
      });

      if (response?.shows?.[0]) {
        const transformed = transformShowToViewData(response.shows[0]);
        return { genreTitle, show: { ...transformed, key: transformed.slug } };
      }
    } catch (error) {
      throw error;
    }
    return { genreTitle, show: null };
  });

  // Fetch archive shows promise
  const archivePromise = getEpisodesForShows({ limit: 5, offset: randomOffset });

  const displayHeroItems = homepageData?.metadata?.display_hero_items ?? false;
  const heroLayout = homepageData?.metadata?.heroLayout;
  const heroItemsRaw = homepageData?.metadata?.heroItems || [];

  // Build hero items only if display_hero_items is enabled.
  // Hero items can be any featured content type (episodes, editorial posts,
  // hosts, series/takeovers, videos) - not just episodes. Episodes are
  // enriched with full data (for the inline player); other types render from
  // the already-populated relationship data (homepage fetch uses depth 4).
  const HERO_SUPPORTED_TYPES = new Set([
    'episode',
    'episodes',
    'posts',
    'hosts',
    'takeovers',
    'videos',
  ]);

  const heroItemsPromise =
    displayHeroItems && heroItemsRaw.length > 0
      ? Promise.all(
          heroItemsRaw
            .filter(item => HERO_SUPPORTED_TYPES.has(item.type))
            .map(async item => {
              const isEpisode = item.type === 'episode' || item.type === 'episodes';

              if (isEpisode) {
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
              }

              // Non-episode hero items (editorial, host, series, video) render
              // directly from their relationship data - no audio/player URL.
              return {
                ...item,
                key: item.slug,
                url: '',
              };
            })
        ).then(items => items.filter(Boolean))
      : Promise.resolve([]);

  // Execute genre/archive and hero fetches in parallel
  const [genreResults, archiveResponse, heroItems] = await Promise.all([
    Promise.all(genrePromises),
    archivePromise,
    heroItemsPromise,
  ]);

  // Build randomShowsByGenre from parallel results
  const randomShowsByGenre: Record<string, any> = {};
  for (const { genreTitle, show } of genreResults) {
    if (show) randomShowsByGenre[genreTitle] = show;
  }

  // Prefer the editor's hand-picked archive selection, falling back to random episodes.
  const curatedArchive = homepageData?.metadata?.archive_shows || [];
  const archiveSource = curatedArchive.length > 0 ? curatedArchive : archiveResponse.shows || [];
  const archiveShows = archiveSource.map((show: any) => {
    const transformed = transformShowToViewData(show);
    return { ...transformed, key: transformed.slug };
  });

  // Check if sections are in page_order (new system) or should use old system
  const hasColouredSectionsInOrder = pageOrder.some(item => item.type === 'coloured-sections');

  // Auto-generated blocks render at fixed positions by default, but if the
  // editor has placed a corresponding marker block in page_order, render them
  // there instead (and suppress the fixed-position fallback to avoid duplicates).
  const hasGenreSelectorInOrder = pageOrder.some(item => item.type === 'genre-selector');
  const hasArchiveBlockInOrder = pageOrder.some(item => item.type === 'archive-block');
  const hasVideoBlockInOrder = pageOrder.some(item => item.type === 'video-block');
  const hasEditorialBlockInOrder = pageOrder.some(item => item.type === 'editorial-block');

  const renderContext: HomepageRenderContext = {
    colouredSections,
    archiveShows,
    videos: videosData.videos,
    posts: postsData.posts,
    genreSelector: {
      shows,
      randomShowsByGenre,
      allCanonicalGenres: canonicalGenres,
    },
  };

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

        {/* Coloured Sections - use page_order if available, otherwise hardcoded */}
        {!hasColouredSectionsInOrder && (
          <Suspense>
            <ColouredSectionGallery
              colouredSections={colouredSections}
              homepageData={{
                metadata: { coloured_sections: homepageData?.metadata?.coloured_sections },
              }}
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
                <UpcomingEpisodes />
              </Suspense>
            );
          }

          return (
            <Suspense key={`${item.type}-${item.id}-${index}`} fallback={<div>Loading...</div>}>
              {renderPageOrderItem(item, renderContext)}
            </Suspense>
          );
        })}

        {/* From The Archive Section - fixed position fallback */}
        {!hasArchiveBlockInOrder && archiveShows.length > 0 && (
          <ArchiveSection shows={archiveShows} className='pt-8' />
        )}

        {/* Genre Selector Section - fixed position fallback */}
        {!hasGenreSelectorInOrder && (
          <Suspense>
            <GenreSelector
              shows={shows}
              randomShowsByGenre={randomShowsByGenre}
              allCanonicalGenres={canonicalGenres}
            />
          </Suspense>
        )}

        {/* Video Section - fixed position fallback */}
        {!hasVideoBlockInOrder && videosData.videos.length > 0 && (
          <VideoSection videos={videosData.videos} className='pt-8' />
        )}

        {/* Editorial Section - fixed position fallback */}
        {!hasEditorialBlockInOrder && postsData.posts.length > 0 && (
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
