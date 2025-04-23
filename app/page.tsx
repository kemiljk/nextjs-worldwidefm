import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getVideos, getAllPosts } from "@/lib/actions";
import { getMixcloudShows, MixcloudShow, filterWorldwideFMTags } from "@/lib/mixcloud-service";
import EditorialSection from "@/components/editorial/editorial-section";
import VideoSection from "@/components/video/video-section";
import ArchiveSection from "@/components/archive/archive-section";
import { addHours, isWithinInterval, isSameDay } from "date-fns";
import GenreSelector from "@/components/genre-selector";
import { Suspense } from "react";
import FeaturedSections from "@/components/featured-sections";

// Add consistent revalidation time for Mixcloud content
export const revalidate = 900; // 15 minutes

export default async function Home() {
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
  const getCurrentShow = (shows: MixcloudShow[]) => {
    const now = new Date();
    console.log("Current time:", now);

    if (!shows.length) return null;

    // Find the most recent show that started within the last 2 hours
    const currentShow = shows.find((show: MixcloudShow) => {
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
  const upcomingShows = recentShows.filter((show: MixcloudShow) => show.key !== showToDisplay.key).slice(0, 5);

  // Get shows from the archive
  const { shows: archiveShows } = await getMixcloudShows({ random: true, limit: 20 });

  // Check if a show is from today
  const isShowFromToday = (show: MixcloudShow | null) => {
    if (!show) return false;
    const showDate = new Date(show.created_time);
    const today = new Date();
    return isSameDay(showDate, today);
  };

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

  return (
    <div className="min-h-screen -mx-4 md:-mx-8 lg:-mx-16">
      {/* Main content */}
      <div className="mx-auto mt-4">
        {/* NOW and LATER sections */}
        <Suspense>
          <FeaturedSections showToDisplay={showToDisplay} hasLiveShow={hasLiveShow} transformedUpcomingShows={transformedUpcomingShows} />
        </Suspense>

        {/* Genre Selector Section */}
        <Suspense>
          <GenreSelector shows={shows} />
        </Suspense>

        {/* From The Archive Section */}
        <ArchiveSection shows={archiveShows} className="px-4 md:px-8 lg:px-24 py-8 border-t border-green-900 bg-green-600" />

        {/* Video Section */}
        <VideoSection videos={videos} className="px-4 md:px-8 lg:px-24 py-8 border-t border-crimson-900 bg-crimson-500" />

        {/* Editorial section */}
        <EditorialSection title="POSTS" posts={posts} className="px-4 md:px-8 lg:px-24 py-8 border-t border-sky-900 bg-sky-300" isHomepage={true} />
      </div>
    </div>
  );
}
