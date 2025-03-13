"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ChevronRight, Volume2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRadioShows, useSchedule } from "@/lib/hooks";
import { CosmicDebugger } from "@/components/CosmicDebugger";

// Keep the mock data for editorial content for now
import { mockData } from "@/lib/mock-data";

export default function Home() {
  // Use real data from Cosmic CMS for radio shows and schedule
  const { shows: featuredShows, loading: showsLoading, error: showsError } = useRadioShows(5);
  const { currentShow, upcomingShow, loading: scheduleLoading, error: scheduleError } = useSchedule();

  // Keep using mock data for editorial content
  const { editorial } = mockData;

  // State for the selected show
  const [selectedShow, setSelectedShow] = useState(featuredShows[0]);

  // Update selected show when featured shows load
  useEffect(() => {
    if (featuredShows.length > 0) {
      setSelectedShow(featuredShows[0]);
    }
  }, [featuredShows]);

  // Show errors if any
  if (showsError || scheduleError) {
    return (
      <div className="min-h-screen bg-brand-beige">
        <div className="container mx-auto pt-32 pb-32">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6">
            <h2 className="text-lg font-semibold mb-2">Error Loading Data</h2>
            <p>{showsError?.message || scheduleError?.message}</p>
          </div>

          {/* Add debugger to help diagnose issues */}
          <CosmicDebugger />

          {/* Display mock data as fallback */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mt-4">
            <p className="text-yellow-800">Using mock data as fallback. Please check your Cosmic CMS configuration.</p>
          </div>

          {/* Continue with the page using mock data */}
          {/* ... rest of your page */}
        </div>
      </div>
    );
  }

  // Loading state
  if (showsLoading || scheduleLoading) {
    return (
      <div className="min-h-screen bg-brand-beige flex items-center justify-center">
        <p className="text-xl text-brand-orange animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-beige">
      {/* Main content */}
      <div className="container mx-auto pt-32 pb-32">
        {/* Temporarily add the debugger at the top of the page */}
        {process.env.NODE_ENV !== "production" && <CosmicDebugger />}

        {/* Gradient background for LATER section */}
        <div className="absolute top-0 bottom-0 right-0 w-1/2 bg-gradient-to-b from-[#F5F2EB] to-transparent z-0" />

        {/* NOW and LATER sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 pb-12 relative z-10">
          {/* NOW section */}
          <div className="flex flex-col h-full pr-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-brand-orange">NOW</h2>
              <Link href="/schedule" className="text-sm text-muted-foreground flex items-center group">
                View Schedule <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <Card className="overflow-hidden border-none shadow-md flex-grow">
              <CardContent className="p-0 relative h-full flex flex-col">
                <Image src={currentShow?.image || "/placeholder.svg"} alt={currentShow?.title || "Current Show"} width={500} height={400} className="w-full h-full object-cover" />
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 text-white">
                  <div className="flex justify-between items-start">
                    <div className="max-w-[70%]">
                      <div className="text-xs font-medium py-1 px-2 bg-black/20 inline-block mb-2">ON NOW</div>
                      <p className="text-sm opacity-80">{currentShow?.subtitle || ""}</p>
                      <h3 className="text-2xl font-bold mt-1">{currentShow?.title || "Loading show..."}</h3>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white rounded-md px-4 py-2 text-sm flex items-center gap-2">
                    <Play className="h-4 w-4 fill-current" /> Playing Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* UP NEXT */}
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-brand-orange mb-4">UP NEXT</h3>
              <div className="border-2 border-dotted border-brand-orange/40 rounded-md p-4 flex items-center justify-between">
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
          <div className="flex flex-col h-full pl-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-brand-orange">LATER</h2>
              <Link href="/archive" className="text-sm text-muted-foreground flex items-center group">
                View Archive <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <Card className="overflow-hidden border-none shadow-md flex-grow">
              <CardContent className="p-0 relative h-full flex flex-col">
                <Image src={selectedShow?.image || "/placeholder.svg"} alt={selectedShow?.title || "Selected Show"} width={500} height={400} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                  <div className="flex justify-between items-end">
                    <p className="text-sm max-w-[70%]">{selectedShow?.description || ""}</p>
                    <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white rounded-md px-4 py-2 text-sm flex items-center gap-2">
                      <Play className="h-4 w-4 fill-current" /> Listen
                    </Button>
                  </div>
                </div>
                <div className="absolute top-1/2 left-4 transform -translate-y-1/2">
                  <Button
                    variant="outline"
                    className="bg-white/20 backdrop-blur-sm text-white rounded-full p-2 hover:bg-white/30"
                    onClick={() => {
                      const currentIndex = featuredShows.findIndex((show) => show === selectedShow);
                      const prevIndex = (currentIndex - 1 + featuredShows.length) % featuredShows.length;
                      setSelectedShow(featuredShows[prevIndex]);
                    }}
                    disabled={featuredShows.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
                  <Button
                    variant="outline"
                    className="bg-white/20 backdrop-blur-sm text-white rounded-full p-2 hover:bg-white/30"
                    onClick={() => {
                      const currentIndex = featuredShows.findIndex((show) => show === selectedShow);
                      const nextIndex = (currentIndex + 1) % featuredShows.length;
                      setSelectedShow(featuredShows[nextIndex]);
                    }}
                    disabled={featuredShows.length <= 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Thumbnail grid */}
            <div className="grid grid-cols-5 gap-2 mt-6">
              {featuredShows.map((show, index) => (
                <button key={index} className={`${selectedShow === show ? "border-2 border-dotted border-brand-orange" : ""} rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-orange`} onClick={() => setSelectedShow(show)}>
                  <Image src={show.thumbnail || "/placeholder.svg"} alt={show.title} width={100} height={100} className="w-full aspect-square object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* EDITORIAL section */}
        <div className="mb-12 bg-brand-blue p-8 rounded-lg z-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">EDITORIAL</h2>
            <Link href="/all" className="text-sm text-gray-300 flex items-center hover:text-white transition-colors group">
              View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* WATCH AND LISTEN */}
            <div className="md:col-span-6">
              <h3 className="text-lg font-medium text-gray-300 mb-4">WATCH AND LISTEN</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Album of the Week */}
                <Card className="overflow-hidden border-none shadow-md bg-brand-blue-light">
                  <CardContent className="p-0 relative">
                    <div className="absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10">Album Of The Week</div>
                    <Image src={editorial.albumOfTheWeek.image || "/placeholder.svg"} alt={editorial.albumOfTheWeek.title} width={300} height={300} className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3 text-white">
                      <div className="flex items-center justify-between">
                        <p className="text-sm pr-2">{editorial.albumOfTheWeek.description}</p>
                        <Button variant="ghost" className="text-white rounded-full p-2 hover:bg-white/20 flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Events */}
                <Card className="overflow-hidden border-none shadow-md bg-brand-blue-light">
                  <CardContent className="p-0 relative">
                    <div className="absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10">Events</div>
                    <Image src={editorial.events.image || "/placeholder.svg"} alt={editorial.events.title} width={300} height={300} className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3 text-white">
                      <div className="flex items-center justify-between">
                        <p className="text-sm pr-2">{editorial.events.description}</p>
                        <Button variant="ghost" className="text-white rounded-full p-2 hover:bg-white/20 flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Video - Full width */}
                <Card className="overflow-hidden border-none shadow-md bg-brand-blue-light col-span-2 mt-4">
                  <CardContent className="p-0 relative">
                    <div className="absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10">Video</div>
                    <Image src={editorial.video.image || "/placeholder.svg"} alt={editorial.video.title} width={600} height={300} className="w-full aspect-video object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3 text-white">
                      <div className="flex items-center justify-between">
                        <p className="text-sm pr-2">{editorial.video.description}</p>
                        <Button variant="ghost" className="text-white rounded-full p-2 hover:bg-white/20 flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* READ */}
            <div className="md:col-span-6">
              <h3 className="text-lg font-medium text-gray-300 mb-4">READ</h3>

              <div className="grid gap-4">
                {editorial.articles.map((article, index) => (
                  <Card key={index} className="overflow-hidden border-none shadow-md bg-brand-blue-light">
                    <CardContent className="p-0 flex">
                      <div className="w-1/3">
                        <Image src={article.image || "/placeholder.svg"} alt={article.title} width={200} height={200} className="w-full h-full object-cover" />
                      </div>
                      <div className="w-2/3 p-4">
                        <div className="text-sm text-gray-300 mb-1">
                          {article.date} • {article.author}
                        </div>
                        <h4 className="text-lg font-bold mb-2 text-white">{article.title}</h4>
                        <p className="text-sm text-gray-200 line-clamp-3">{article.excerpt}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media player */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 max-w-lg w-full bg-[#9DAC97] text-white rounded-lg shadow-lg z-50 flex items-center px-4 py-3">
        <Button variant="ghost" className="text-white mr-2 hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center flex-1 mx-2">
          <div className="w-10 h-10 rounded overflow-hidden mr-3 flex-shrink-0">
            <Image src={currentShow?.thumbnail || "/placeholder.svg?height=40&width=40"} alt={currentShow?.title || "Now playing"} width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <div className="font-medium">{currentShow?.title || "No show playing"}</div>
        </div>
        <Button variant="ghost" className="text-white mr-2 hover:bg-white/10">
          <Volume2 className="h-5 w-5" />
        </Button>
        <div className="border-l border-white/20 pl-2 flex items-center gap-2">
          <Button className="bg-black/20 hover:bg-black/30 text-white">PLAY / STOP</Button>
        </div>
      </div>
    </div>
  );
}
