import { getVideos, getAllPosts } from "@/lib/actions";
import { getMixcloudShows, MixcloudShow, filterWorldwideFMTags } from "@/lib/mixcloud-service";
import EditorialSection from "@/components/editorial/editorial-section";
import VideoSection from "@/components/video/video-section";
import ArchiveSection from "@/components/archive/archive-section";
import { addHours, isWithinInterval, isSameDay } from "date-fns";
import GenreSelector from "@/components/genre-selector";
import { Suspense } from "react";
import FeaturedSections from "@/components/featured-sections";
import { CosmicAPIObject, CosmicHomepageData, HomepageSectionItem, ProcessedHomepageSection } from "@/lib/cosmic-types";
import HomepageHero from "@/components/homepage-hero";
import InsertedSection from "@/components/inserted-section";

// Add consistent revalidation time for Mixcloud content
export const revalidate = 900; // 15 minutes

// TODO: Move these to environment variables (e.g., process.env.COSMIC_BUCKET_SLUG, process.env.COSMIC_READ_KEY)
const COSMIC_BUCKET_SLUG = "worldwide-fm-production";
const COSMIC_READ_KEY = "Qo9hr8E9Vef66JrXQdyVrh29CVkd7Vz9GuGVdiQIClX6U7N9oh";
const COSMIC_HOMEPAGE_ID = "67f91dfd43f4b238152e7003";

async function getCosmicHomepageData(): Promise<CosmicHomepageData | null> {
  const url = `https://api.cosmicjs.com/v3/buckets/${COSMIC_BUCKET_SLUG}/objects/${COSMIC_HOMEPAGE_ID}?pretty=true&read_key=${COSMIC_READ_KEY}&depth=1&props=slug,title,metadata,type`;
  try {
    // Temporarily reduced revalidation time for testing
    const response = await fetch(url, { next: { revalidate: 10 } });
    if (!response.ok) {
      console.error("Failed to fetch Cosmic homepage data:", response.status, await response.text());
      return null;
    }
    const data: CosmicAPIObject<CosmicHomepageData> = await response.json();
    return data.object;
  } catch (error) {
    console.error("Error fetching Cosmic homepage data:", error);
    return null;
  }
}

// New function to fetch a single Cosmic object by ID
async function fetchCosmicObjectById(id: string): Promise<HomepageSectionItem | null> {
  const url = `https://api.cosmicjs.com/v3/buckets/${COSMIC_BUCKET_SLUG}/objects/${id}?read_key=${COSMIC_READ_KEY}&props=slug,title,metadata,type`;
  try {
    // Temporarily reduced revalidation time for testing
    const response = await fetch(url, { next: { revalidate: 10 } });
    if (!response.ok) {
      console.error(`Failed to fetch Cosmic object ${id}:`, response.status, await response.text());
      return null;
    }
    const data: CosmicAPIObject<HomepageSectionItem> = await response.json();
    return data.object;
  } catch (error) {
    console.error(`Error fetching Cosmic object ${id}:`, error);
    return null;
  }
}

export default async function Home() {
  // Fetch Cosmic JS Homepage Data
  const cosmicHomepageData = await getCosmicHomepageData();

  // Get recent shows from Mixcloud
  const response = await getMixcloudShows();
  const shows = response?.shows || [];
  console.log("Recent shows:", shows.length);

  // Sort all shows by created time, most recent first
  const sortedShows = [...shows].sort((a: MixcloudShow, b: MixcloudShow) => {
    const dateA = new Date(a.created_time);
    const dateB = new Date(b.created_time);
    return dateB.getTime() - dateA.getTime();
  });

  // Get the most recent show
  const mostRecentShow = sortedShows[0];

  // Function to determine if a show is currently playing
  const getCurrentShow = (showsToFilter: MixcloudShow[]) => {
    const now = new Date();
    console.log("Current time:", now);

    if (!showsToFilter.length) return null;

    // Find the most recent show that started within the last 2 hours
    const currentShow = showsToFilter.find((show: MixcloudShow) => {
      const startTime = new Date(show.created_time);
      const endTime = addHours(startTime, 2); // Assume 2-hour shows
      return isWithinInterval(now, { start: startTime, end: endTime });
    });

    return currentShow || null;
  };

  // Get current show and recent shows
  const currentShow = getCurrentShow(sortedShows) || null; // Don't use mostRecentShow as fallback
  const recentShows = sortedShows.filter((show: MixcloudShow) => !currentShow || show.key !== currentShow.key);

  // Determine if we have a current live show
  const hasLiveShow = currentShow !== null;
  const showToDisplay = currentShow || mostRecentShow;

  // Get the next 5 shows for upcoming, excluding the show that's displayed in Latest/Now
  const upcomingShows = recentShows.filter((show: MixcloudShow) => showToDisplay && show.key !== showToDisplay.key).slice(0, 5);

  // Get shows from the archive
  const { shows: archiveShows } = await getMixcloudShows({ random: true, limit: 20 });

  // Transform shows for ComingUp
  const transformedUpcomingShows = upcomingShows.map((show: MixcloudShow) => ({
    ...show,
    id: show.key,
    title: show.name,
    subtitle: show.tags?.[0]?.name || "",
    description: show.name,
    image: show.pictures.extra_large,
    thumbnail: show.pictures.large,
    slug: show.key,
  }));

  // Get editorial content using server action
  const posts = await getAllPosts();

  // Get videos
  const videos = await getVideos();

  const heroLayout = cosmicHomepageData?.metadata?.heroLayout;
  const heroItems = cosmicHomepageData?.metadata?.heroItems || [];

  // Process dynamic sections to fetch full item data
  const rawDynamicSections = cosmicHomepageData?.metadata?.sections || [];
  const processedDynamicSections: ProcessedHomepageSection[] = await Promise.all(
    rawDynamicSections
      .filter((section) => section.is_active && section.items && section.items.length > 0)
      .map(async (section) => {
        const fetchedItemsPromises = section.items.map((itemId) => fetchCosmicObjectById(itemId));
        const fetchedItems = (await Promise.all(fetchedItemsPromises)).filter(Boolean) as HomepageSectionItem[];
        return {
          ...section,
          items: fetchedItems,
        };
      })
  );

  return (
    <div className="min-h-screen -mx-4 md:-mx-8 lg:-mx-16">
      {/* Main content */}
      <div className="mx-auto mt-4">
        {/* Hero Section: Conditionally render based on Cosmic data or fallback */}
        <Suspense>{heroLayout && <HomepageHero heroLayout={heroLayout} heroItems={heroItems} />}</Suspense>
        <Suspense>{heroItems.length > 0 && <FeaturedSections showToDisplay={showToDisplay} hasLiveShow={hasLiveShow} transformedUpcomingShows={transformedUpcomingShows} />}</Suspense>

        {processedDynamicSections.map((section) => (
          <InsertedSection key={section.title} section={section} />
        ))}

        {/* Genre Selector Section */}
        <Suspense>
          <GenreSelector shows={shows} />
        </Suspense>

        {/* From The Archive Section */}
        <ArchiveSection shows={archiveShows} className="px-4 md:px-8 lg:px-24 py-8 border-t border-green-900 bg-green-600" />

        {/* Video Section */}
        <VideoSection videos={videos} className="px-4 md:px-8 lg:px-24 py-8 border-t border-crimson-900 bg-crimson-500" />

        {/* Editorial section */}
        <EditorialSection title="POSTS" posts={posts} className="px-4 md:px-8 lg:px-24 py-8 border-t border-sky-900 bg-sky-300 dark:bg-sky-800" isHomepage={true} />
      </div>
    </div>
  );
}
