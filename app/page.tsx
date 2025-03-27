import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getScheduleData, getEditorialContent } from "@/lib/actions";
import { transformShowToViewData } from "@/lib/cosmic-service";

// Keep the mock data for editorial content for now
import ClientSideSelectionWrapper from "@/components/client-side-selection-wrapper";
import MediaPlayer from "@/components/media-player";
import EditorialSection from "@/components/editorial/editorial-section";

// This is a server component - no need for useState, useEffect etc.
export default async function Home() {
  // Get the schedule data using server action
  const { schedule, currentShow, upcomingShow, upcomingShows } = await getScheduleData();

  // Get editorial content using server action
  const { posts, featuredPosts } = await getEditorialContent();

  return (
    <div className="min-h-screen">
      {/* Main content */}
      <div className="mx-auto pt-32 pb-32">
        {/* NOW and LATER sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pb-24 relative z-10">
          {/* NOW section */}
          <div className="flex flex-col h-full pr-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-brand-orange">NOW</h2>
              <Link href="/schedule" className="text-sm text-muted-foreground flex items-center group">
                View Schedule <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <Card className="overflow-hidden border-none shadow-md">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  <Image src={currentShow?.image || "/placeholder.svg"} alt={currentShow?.title || "Current Show"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="p-4">
                      <div className="text-xs font-medium rounded-full py-1 px-2 bg-black/20 inline-block mb-2">ON NOW</div>
                      <p className="text-sm text-bronze-100">{currentShow?.subtitle || ""}</p>
                      <h3 className="text-2xl text-bronze-50 font-medium mt-1">{currentShow?.title || "Loading show..."}</h3>
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
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

          {/* LATER section - Wrapped in client-side component for interactivity */}
          <ClientSideSelectionWrapper featuredShows={upcomingShows} title="COMING UP" />
        </div>

        {/* EDITORIAL section */}
        <EditorialSection posts={posts} className="mt-24" />
      </div>

      {/* Media player component */}
      <MediaPlayer currentShow={currentShow} />
    </div>
  );
}
