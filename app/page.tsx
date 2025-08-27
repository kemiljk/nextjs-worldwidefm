import { Suspense } from "react";
import { getCosmicHomepageData, fetchCosmicObjectById, getVideos, getAllPosts, createColouredSections } from "@/lib/actions";
import { getEpisodesForShows } from "@/lib/episode-service";
import EditorialSection from "@/components/editorial/editorial-section";
import VideoSection from "@/components/video/video-section";
import ArchiveSection from "@/components/archive/archive-section";
// Removed date-fns imports as they're no longer needed with simplified FeaturedSections
import GenreSelector from "@/components/genre-selector";
import FeaturedSections from "@/components/featured-sections";
import { HomepageSectionItem, ProcessedHomepageSection, ColouredSection } from "@/lib/cosmic-types";
import HomepageHero from "@/components/homepage-hero";
import InsertedSection from "@/components/inserted-section";
import LatestEpisodes from "@/components/latest-episodes";

// Add consistent revalidation time for episode content
export const revalidate = 900; // 15 minutes

export default async function Home() {
  const [homepageData, videosData, postsData] = await Promise.all([getCosmicHomepageData(), getVideos(), getAllPosts()]);

  // Create coloured sections from homepage data
  const colouredSections = await createColouredSections(homepageData);

  // Get recent episodes from Cosmic
  const response = await getEpisodesForShows({ limit: 20 });
  const shows = response?.shows || [];
  console.log("Recent episodes:", shows.length);

  // Sort all shows by broadcast date, most recent first
  const sortedShows = [...shows].sort((a: any, b: any) => {
    const dateA = new Date(a.broadcast_date || a.created_time);
    const dateB = new Date(b.broadcast_date || b.created_time);
    return dateB.getTime() - dateA.getTime();
  });

  // Removed getCurrentShow function and mostRecentShow variable as they're no longer needed with simplified FeaturedSections

  // Get shows from the archive
  const { shows: archiveShows } = await getEpisodesForShows({ random: true, limit: 20 });

  const heroLayout = homepageData?.metadata?.heroLayout;
  const heroItems = homepageData?.metadata?.heroItems || [];

  // Process dynamic sections to fetch full item data
  const rawDynamicSections = homepageData?.metadata?.sections || [];
  const processedDynamicSections: ProcessedHomepageSection[] = await Promise.all(
    rawDynamicSections
      .filter((section) => section.is_active && section.items && section.items.length > 0)
      .map(async (section) => {
        const fetchedItemsPromises = section.items.map((item: any) => {
          let id: string = "";
          if (typeof item === "string") {
            id = item;
          } else if (item && typeof item === "object" && "id" in item && typeof item.id === "string") {
            id = item.id;
          }
          return fetchCosmicObjectById(id);
        });
        const fetchedItems = (await Promise.all(fetchedItemsPromises)).filter(Boolean) as HomepageSectionItem[];
        return {
          ...section,
          layout: section.layout || "Grid", // Provide default layout if missing
          items: fetchedItems,
        };
      })
  );

  // Create alternating sections: coloured, static, coloured, static, etc.
  const allSections: Array<{ section: ProcessedHomepageSection; colouredSection?: ColouredSection; isColoured: boolean }> = [];

  // Create a proper alternating pattern starting with coloured sections
  const staticSections = [...processedDynamicSections];
  const colouredSectionsArray = [...colouredSections];

  let staticIndex = 0;
  let colouredIndex = 0;

  // Start with coloured section if available, then alternate
  while (staticIndex < staticSections.length || colouredIndex < colouredSectionsArray.length) {
    // Add coloured section if available
    if (colouredIndex < colouredSectionsArray.length) {
      allSections.push({
        section: colouredSectionsArray[colouredIndex],
        colouredSection: homepageData?.metadata?.coloured_sections?.[colouredIndex],
        isColoured: true,
      });
      colouredIndex++;
    }

    // Add static section if available
    if (staticIndex < staticSections.length) {
      allSections.push({
        section: staticSections[staticIndex],
        isColoured: false,
      });
      staticIndex++;
    }
  }

  return (
    <div className="min-h-screen -mx-4 md:-mx-8 lg:-mx-16">
      {/* Main content */}
      <div className="mx-auto mt-4 mb-8">
        {/* Hero Section: Conditionally render based on Cosmic data or fallback */}
        <Suspense>{heroLayout && <HomepageHero heroLayout={heroLayout} heroItems={heroItems} />}</Suspense>
        <Suspense>
          <FeaturedSections shows={sortedShows.slice(0, 2)} />
        </Suspense>

        <Suspense>
          <LatestEpisodes />
        </Suspense>

        {/* All Sections (static and coloured) rendered in order */}
        {allSections.map(({ section, colouredSection, isColoured }, index) => (
          <Suspense key={`${isColoured ? "coloured" : "static"}-${section.title}-${index}`} fallback={<div>Loading...</div>}>
            <InsertedSection section={section} colouredSection={colouredSection} />
          </Suspense>
        ))}

        {/* Genre Selector Section */}
        <Suspense>
          <GenreSelector shows={shows} />
        </Suspense>
        {/* From The Archive Section */}
        {archiveShows.length > 0 && <ArchiveSection shows={archiveShows} className="px-5 pt-8" />}
        {/* Video Section */}
        {videosData.videos.length > 0 && <VideoSection videos={videosData.videos} className="px-5 pt-8" />}
        {/* Editorial section */}
        {postsData.posts.length > 0 && <EditorialSection title="POSTS" posts={postsData.posts} className="px-5 pt-8" isHomepage={true} />}
      </div>
    </div>
  );
}
