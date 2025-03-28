import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getEditorialContent, getVideos, getAllShows } from "@/lib/actions";
import { transformShowToViewData } from "@/lib/cosmic-service";
import ClientSideSelectionWrapper from "@/components/client-side-selection-wrapper";
import MediaPlayer from "@/components/media-player";
import EditorialSection from "@/components/editorial/editorial-section";
import VideoSection from "@/components/video/video-section";
import { addHours, isWithinInterval, isBefore, isAfter, parseISO, format } from "date-fns";

// This is a server component - no need for useState, useEffect etc.
export default async function Home() {
  // Get all shows and transform them
  const shows = await getAllShows();
  const transformedShows = shows.map(transformShowToViewData);

  // Get editorial content using server action
  const { posts, featuredPosts } = await getEditorialContent();

  // Get videos using server action
  const videos = await getVideos(4);

  // Function to determine if a show is currently playing
  const getCurrentShow = (shows: any[]) => {
    const now = new Date();

    // Sort shows by broadcast date, most recent first
    const sortedShows = [...shows].sort((a, b) => {
      const dateA = parseISO(a.metadata?.broadcast_date || "");
      const dateB = parseISO(b.metadata?.broadcast_date || "");
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateB.getTime() - dateA.getTime();
    });

    // Find the most recent show that started within the last 2 hours
    const currentShow = sortedShows.find((show) => {
      if (!show.metadata?.broadcast_date) return false;
      const startTime = parseISO(show.metadata.broadcast_date);
      const endTime = addHours(startTime, 2); // Assume 2-hour shows
      return isWithinInterval(now, { start: startTime, end: endTime });
    });

    return currentShow || null;
  };

  // Function to get upcoming shows
  const getUpcomingShows = (shows: any[], currentShow: any) => {
    const now = new Date();

    return shows
      .filter((show) => {
        if (!show.metadata?.broadcast_date) return false;
        const startTime = parseISO(show.metadata.broadcast_date);
        // Show is in the future and not the current show
        return isAfter(startTime, now) && (!currentShow || show.id !== currentShow.id);
      })
      .sort((a, b) => {
        const dateA = parseISO(a.metadata.broadcast_date);
        const dateB = parseISO(b.metadata.broadcast_date);
        return dateA.getTime() - dateB.getTime();
      });
  };

  // Function to get latest shows (past shows)
  const getLatestShows = (shows: any[], currentShow: any) => {
    const now = new Date();

    return shows
      .filter((show) => {
        if (!show.metadata?.broadcast_date) return false;
        const startTime = parseISO(show.metadata.broadcast_date);
        // Show is in the past and not the current show
        return isBefore(startTime, now) && (!currentShow || show.id !== currentShow.id);
      })
      .sort((a, b) => {
        const dateA = parseISO(a.metadata.broadcast_date);
        const dateB = parseISO(b.metadata.broadcast_date);
        return dateB.getTime() - dateA.getTime(); // Most recent first
      });
  };

  // Get current and upcoming shows
  const currentShow = getCurrentShow(transformedShows);
  const upcomingShows = getUpcomingShows(transformedShows, currentShow);
  const latestShows = getLatestShows(transformedShows, currentShow);
  const nextShow = upcomingShows[0];

  // Limit posts and shows for homepage
  const limitedPosts = posts.slice(0, 4);
  const limitedUpcomingShows = upcomingShows.slice(0, 5);
  const limitedLatestShows = latestShows.slice(0, 4);
  const limitedFeaturedShows = transformedShows.filter((show) => show.featured_on_homepage);

  return (
    <div className="min-h-screen -mx-4 md:-mx-8 lg:-mx-16">
      {/* Main content */}
      <div className="mx-auto pt-16 lg:pt-8">
        {/* NOW and LATER sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 relative z-10">
          {/* NOW section */}
          <div className="flex flex-col h-full p-4 md:p-8 lg:p-24 border-b lg:border-b-0 lg:border-r border-bronze-900 dark:border-bronze-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-brand-orange">NOW</h2>
              <Link href="/schedule" className="text-sm text-muted-foreground flex items-center group">
                View Schedule <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <Card className="overflow-hidden shadow-none border-none">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  <Image src={currentShow?.image || "/image-placeholder.svg"} alt={currentShow?.title || "Current Show"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="p-4">
                      <div className="text-xs font-medium py-1 px-2 bg-black/80 text-white inline-block mb-2">ON NOW</div>
                      <p className="text-sm text-bronze-100">{currentShow?.subtitle || ""}</p>
                      <h3 className="text-2xl text-bronze-50 font-medium mt-1">{currentShow?.title || "No show currently playing"}</h3>
                    </div>
                  </div>
                  {currentShow && (
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
              <div className="border border-brand-orange/40 p-4 flex items-center rounded-none justify-between">
                <div>
                  <p className="text-sm text-foreground">{nextShow?.title || "No upcoming show"}</p>
                </div>
                <Button variant="outline" className="text-brand-orange border-brand-orange hover:bg-brand-orange/10">
                  Playing Next
                </Button>
              </div>
            </div>
          </div>

          {/* LATER section */}
          <ClientSideSelectionWrapper featuredShows={limitedUpcomingShows} title="COMING UP" />
        </div>

        {/* Featured Shows Section */}
        <section className="px-4 md:px-8 lg:px-24 py-16 border-t border-bronze-900 bg-bronze-500">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-medium text-bronze-50">FEATURED SHOWS</h2>
            <Link href="/schedule" className="text-sm text-bronze-50 flex items-center group">
              View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {limitedFeaturedShows.map((show, index) => (
              <Link key={index} href={`/schedule/${show.slug}`}>
                <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <Image src={show.image || "/image-placeholder.svg"} alt={show.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-lg leading-tight font-medium text-white line-clamp-2">{show.title}</h3>
                          <p className="text-sm text-white/80 mt-1">{show.subtitle}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Latest Shows Section */}
        <section className="px-4 md:px-8 lg:px-24 py-16 border-t border-green-900 bg-green-600">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-medium text-green-50">LATEST SHOWS</h2>
            <Link href="/archive" className="text-sm text-green-50 flex items-center group">
              View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {limitedLatestShows.map((show, index) => (
              <Link key={index} href={`/archive/${show.slug}`}>
                <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <Image src={show.image || "/image-placeholder.svg"} alt={show.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-lg leading-tight font-medium text-white line-clamp-2">{show.title}</h3>
                          <p className="text-sm text-white/80 mt-1">{show.subtitle}</p>
                          {show.metadata?.broadcast_date && <p className="text-xs text-white/60 mt-1">{format(parseISO(show.metadata.broadcast_date), "MMM d, yyyy")}</p>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Video Section */}
        <VideoSection videos={videos} className="px-4 md:px-8 lg:px-24 py-16 border-t border-crimson-900 bg-crimson-500" />

        {/* Editorial section */}
        <EditorialSection title="EDITORIAL" posts={limitedPosts} className="px-4 md:px-8 lg:px-24 py-16 border-t border-sky-900 bg-sky-300" isHomepage={true} />
      </div>

      {/* Media player component */}
      <MediaPlayer currentShow={currentShow} />
    </div>
  );
}
