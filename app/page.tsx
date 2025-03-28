import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getScheduleData, getEditorialContent, getVideos, getAllShows } from "@/lib/actions";
import { transformShowToViewData } from "@/lib/cosmic-service";
import ClientSideSelectionWrapper from "@/components/client-side-selection-wrapper";
import MediaPlayer from "@/components/media-player";
import EditorialSection from "@/components/editorial/editorial-section";
import VideoSection from "@/components/video/video-section";

// This is a server component - no need for useState, useEffect etc.
export default async function Home() {
  // Get the schedule data using server action
  const { schedule, currentShow, upcomingShow, upcomingShows } = await getScheduleData();
  const shows = await getAllShows();
  const transformedShows = shows.map(transformShowToViewData);

  // Get editorial content using server action
  const { posts, featuredPosts } = await getEditorialContent();

  // Get videos using server action
  const videos = await getVideos(4);

  // Limit posts to 4 for homepage
  const limitedPosts = posts.slice(0, 4);
  const limitedUpcomingShows = upcomingShows.slice(0, 5);
  const limitedFeaturedShows = transformedShows.filter((show) => show.featured_on_homepage);
  return (
    <div className="min-h-screen -mx-4 md:-mx-8 lg:-mx-16">
      {/* Main content */}
      <div>
        {/* NOW and LATER sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 relative z-10">
          {/* NOW section */}
          <div className="flex flex-col h-full p-24 border border-black/20 dark:border-tan-50/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-brand-orange">NOW</h2>
              <Link href="/schedule" className="text-sm text-muted-foreground flex items-center group">
                View Schedule <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <Card className="overflow-hidden shadow-none border-none">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  <Image src={currentShow?.image || "/placeholder.svg"} alt={currentShow?.title || "Current Show"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="p-4">
                      <div className="text-xs font-medium py-1 px-2 bg-black/80 text-white inline-block mb-2">ON NOW</div>
                      <p className="text-sm text-bronze-100">{currentShow?.subtitle || ""}</p>
                      <h3 className="text-2xl text-bronze-50 font-medium mt-1">{currentShow?.title || "Loading show..."}</h3>
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm text-white">ON AIR</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* UP NEXT */}
            <div className="mt-6">
              <h3 className="text-xl font-medium text-brand-orange mb-4">UP NEXT</h3>
              <div className="border-2 border-brand-orange/40 p-4 flex items-center rounded-none justify-between">
                <div>
                  <p className="text-sm text-foreground">{upcomingShow?.title || "No upcoming show"}</p>
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
                      <Image src={show.image || "/placeholder.svg"} alt={show.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-lg leading-tight  font-medium text-white line-clamp-2">{show.title}</h3>
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
            {limitedUpcomingShows.map((show, index) => (
              <Link key={index} href={`/archive/${show.slug}`}>
                <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <Image src={show.image || "/placeholder.svg"} alt={show.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-lg leading-tight  font-medium text-white line-clamp-2">{show.title}</h3>
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

        {/* Video Section */}
        <VideoSection videos={videos} className="px-4 md:px-8 lg:px-24 py-16 border-t border-crimson-900 bg-crimson-500" />

        {/* Editorial section */}
        <EditorialSection posts={limitedPosts} className="px-4 md:px-8 lg:px-24 py-16 border-t border-sky-900 bg-sky-300" isHomepage={true} />
      </div>

      {/* Media player component */}
      <MediaPlayer currentShow={currentShow} />
    </div>
  );
}
