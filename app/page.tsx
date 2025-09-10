import { Suspense } from "react";
import { Metadata } from "next";
import { getCosmicHomepageData, fetchCosmicObjectById, getVideos, getAllPosts, createColouredSections } from "@/lib/actions";
import { generateHomepageMetadata } from "@/lib/metadata-utils";
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
import ColouredSectionGallery from "@/components/coloured-section-gallery";

// Add consistent revalidation time for episode content
export const revalidate = 900; // 15 minutes

// Generate metadata for the homepage
export async function generateMetadata(): Promise<Metadata> {
  try {
    const homepageData = await getCosmicHomepageData();
    return generateHomepageMetadata(homepageData);
  } catch (error) {
    console.error("Error generating metadata:", error);
    return generateHomepageMetadata();
  }
}

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

  return (
    <div className="w-full min-h-screen">
      {/* Main content */}
      <div className="mt-4">
        {/* Hero Section: Conditionally render based on Cosmic data or fallback */}
        <Suspense>{heroLayout && <HomepageHero heroLayout={heroLayout} heroItems={heroItems} />}</Suspense>
        <Suspense>
          <FeaturedSections shows={sortedShows.slice(0, 2)} />
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
        {archiveShows.length > 0 && <ArchiveSection shows={archiveShows} className="pt-8" />}
        {/* Genre Selector Section */}
        <Suspense>
          <GenreSelector shows={shows} />
        </Suspense>

        {/* Video Section */}
        {videosData.videos.length > 0 && <VideoSection videos={videosData.videos} className="pt-8" />}
        {/* Editorial section */}
        {postsData.posts.length > 0 && <EditorialSection title="POSTS" posts={postsData.posts} className="px-5 pt-8" isHomepage={true} />}
      </div>
    </div>
  );
}
