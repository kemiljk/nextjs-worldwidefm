import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getVideos, getAllPosts } from "@/lib/actions";
import { getMixcloudShows, MixcloudShow } from "@/lib/mixcloud-service";
import EditorialSection from "@/components/editorial/editorial-section";
import VideoSection from "@/components/video/video-section";
import { addHours, isWithinInterval, isSameDay } from "date-fns";
import ComingUp from "@/components/coming-up";
import GenreSelector from "@/components/genre-selector";
import { Suspense } from "react";

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

  // Get 4 random shows from the archive
  const { shows: archiveShows } = await getMixcloudShows({ random: true, limit: 4 });

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
  const limitedPosts = posts.slice(0, 4);

  // Get videos
  const videos = await getVideos(4);

  return (
    <div className="min-h-screen -mx-4 md:-mx-8 lg:-mx-16">
      {/* Main content */}
      <div className="mx-auto md:-mt-8 lg:-mt-20">
        {/* NOW and LATER sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 relative z-10">
          {/* NOW or LATEST section depending on if there's a current show */}
          <div className="flex flex-col h-full p-4 md:p-8 lg:p-24 border-b md:border-b-0 md:border-r border-bronze-900 dark:border-bronze-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-brand-orange">{hasLiveShow ? "NOW" : "LATEST"}</h2>
              <Link href="/shows" className="text-sm text-muted-foreground flex items-center group">
                View Shows <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <Card className="overflow-hidden shadow-none border-none">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  <Image src={showToDisplay?.pictures.extra_large || "/image-placeholder.svg"} alt={showToDisplay?.name || "Show"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="p-4">
                      {hasLiveShow ? <div className="text-xs font-medium py-1 px-2 bg-black/80 text-white inline-block mb-2">ON NOW</div> : <div className="text-xs font-medium py-1 px-2 bg-black/80 text-white inline-block mb-2">LATEST</div>}
                      {showToDisplay?.tags && showToDisplay.tags.length > 0 && <p className="text-sm text-bronze-100">{showToDisplay.tags[0].name}</p>}
                      <h3 className="text-2xl text-bronze-50 font-medium mt-1">{showToDisplay?.name || "No show available"}</h3>
                    </div>
                  </div>
                  {/* Only show the ON AIR indicator for current live shows */}
                  {hasLiveShow && (
                    <div className="absolute bottom-4 right-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-white">ON AIR</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* UP NEXT */}
            <div className="mt-6">
              <h3 className="text-xl font-medium text-brand-orange mb-4">UP NEXT</h3>
              <div className="border border-brand-orange/40 p-4 flex flex-col md:flex-row items-start md:items-center rounded-none justify-between gap-4">
                <p className="text-sm text-foreground">{upcomingShows[0]?.name || "No upcoming show"}</p>
                <div className="w-max whitespace-nowrap text-brand-orange border border-brand-orange px-4 py-2">Playing Next</div>
              </div>
            </div>
          </div>

          {/* COMING UP section using ComingUp */}
          <div className="h-full">
            <ComingUp featuredShows={transformedUpcomingShows} title="COMING UP" />
          </div>
        </div>

        {/* Genre Selector Section */}
        <Suspense>
          <GenreSelector shows={shows} />
        </Suspense>

        {/* From The Archive Section */}
        <section className="px-4 md:px-8 lg:px-24 py-16 border-t border-green-900 bg-green-600">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-medium text-green-50">FROM THE ARCHIVE</h2>
            <Link href="/shows" className="text-sm text-green-50 flex items-center group">
              View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {archiveShows.map((show: MixcloudShow) => {
              // Convert key to path segments
              const segments = show.key.split("/").filter(Boolean);
              const showPath = segments.join("/");

              return (
                <Link key={show.key} href={`/shows/${showPath}`}>
                  <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="relative aspect-square">
                        <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                          <div className="absolute bottom-4 left-4 right-4">
                            <h3 className="text-lg leading-tight font-medium text-white line-clamp-2">{show.name}</h3>
                            {show.tags && show.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {show.tags.map((tag) => (
                                  <span key={tag.key} className="text-xs text-white/80 bg-black/20 px-2 py-0.5 rounded-full">
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-white/60 mt-1">{new Date(show.created_time).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Video Section */}
        <VideoSection videos={videos} className="px-4 md:px-8 lg:px-24 py-16 border-t border-crimson-900 bg-crimson-500" />

        {/* Editorial section */}
        <EditorialSection title="POSTS" posts={limitedPosts} className="px-4 md:px-8 lg:px-24 py-16 border-t border-sky-900 bg-sky-300" isHomepage={true} />
      </div>
    </div>
  );
}
