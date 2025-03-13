import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRadioShows, getSchedule, transformShowToViewData, getEditorialHomepage, getArticles } from "@/lib/cosmic-service";

// Keep the mock data for editorial content for now
import ClientSideSelectionWrapper from "@/components/client-side-selection-wrapper";
import MediaPlayer from "@/components/media-player";
import EditorialSection from "@/components/editorial/editorial-section";
import { ArticleObject, WatchAndListenObject, MoodObject } from "@/lib/cosmic-config";

// This is a server component - no need for useState, useEffect etc.
export default async function Home() {
  // Get the schedule data statically
  const scheduleResponse = await getSchedule();

  // Determine the current show and upcoming show from the schedule
  let currentShow = null;
  let upcomingShow = null;
  let currentShowId = null;
  let showsToExclude: string[] = [];

  // Check if we have a schedule object in the response
  if (scheduleResponse.objects && scheduleResponse.objects.length > 0) {
    const scheduleObject = scheduleResponse.objects[0];

    // Check if there are shows in the schedule
    if (scheduleObject.metadata && scheduleObject.metadata.shows && Array.isArray(scheduleObject.metadata.shows) && scheduleObject.metadata.shows.length > 0) {
      // Get the first show from the schedule as the current show
      const currentShowData = scheduleObject.metadata.shows[0];

      if (currentShowData) {
        const imageUrl = currentShowData.metadata?.image?.imgix_url || "/placeholder.svg";
        currentShowId = currentShowData.id;
        // Add to exclusion list for the API query
        if (currentShowId) {
          showsToExclude.push(currentShowId);
        }

        currentShow = {
          id: currentShowData.id,
          title: currentShowData.title || "Unknown Show",
          subtitle: currentShowData.metadata?.subtitle || "",
          description: currentShowData.metadata?.description || "",
          image: imageUrl,
          thumbnail: imageUrl ? `${imageUrl}?w=100&h=100&fit=crop` : "/placeholder.svg",
          slug: currentShowData.slug || "",
        };
      }

      // Get the second show from the schedule as the upcoming show
      if (scheduleObject.metadata.shows.length > 1) {
        const upcomingShowData = scheduleObject.metadata.shows[1];

        if (upcomingShowData) {
          const imageUrl = upcomingShowData.metadata?.image?.imgix_url || "/placeholder.svg";
          // We could also exclude the upcoming show if desired
          // if (upcomingShowData.id) {
          //   showsToExclude.push(upcomingShowData.id);
          // }

          upcomingShow = {
            id: upcomingShowData.id,
            title: upcomingShowData.title || "Unknown Show",
            subtitle: upcomingShowData.metadata?.subtitle || "",
            description: upcomingShowData.metadata?.description || "",
            image: imageUrl,
            thumbnail: imageUrl ? `${imageUrl}?w=100&h=100&fit=crop` : "/placeholder.svg",
            slug: upcomingShowData.slug || "",
          };
        }
      }
    }
  }

  // Fetch shows for the LATER section - with exclusion of current show at the API level
  const showsResponse = await getRadioShows({
    limit: 8,
    sort: "-order",
    exclude_ids: showsToExclude.length > 0 ? showsToExclude : undefined,
  });

  let featuredShows = showsResponse.objects ? showsResponse.objects.map(transformShowToViewData) : [];

  // If we couldn't exclude at the API level or just as a safety check, filter again
  if (currentShowId && featuredShows.some((show) => show.id === currentShowId)) {
    featuredShows = featuredShows.filter((show) => show.id !== currentShowId);
  }

  // Handle fallback to featured shows if there's no schedule data
  if (!currentShow && featuredShows.length > 0) {
    currentShow = featuredShows[0];
    featuredShows = featuredShows.slice(1);

    if (featuredShows.length > 0) {
      upcomingShow = featuredShows[0];
      featuredShows = featuredShows.slice(1);
    }
  }

  // Make sure we have at least 5 shows for the thumbnails (or less if that's all we have)
  featuredShows = featuredShows.slice(0, 5);

  // Fetch editorial content from Cosmic
  const editorialResponse = await getEditorialHomepage();

  // Set up default empty arrays/nulls for editorial content
  let albumOfTheWeek: WatchAndListenObject | null = null;
  let events: WatchAndListenObject | null = null;
  let video: WatchAndListenObject | null = null;
  let articles: ArticleObject[] = [];
  let moods: MoodObject[] = [];

  // Parse the editorial content if it exists
  if (editorialResponse.object) {
    const editorialData = editorialResponse.object;

    // Get the featured content
    albumOfTheWeek = editorialData.metadata?.featured_album || null;
    events = editorialData.metadata?.featured_event || null;
    video = editorialData.metadata?.featured_video || null;

    // Get featured articles and moods
    if (editorialData.metadata?.featured_articles && Array.isArray(editorialData.metadata.featured_articles) && editorialData.metadata.featured_articles.length > 0) {
      console.log("Found featured articles in editorial:", editorialData.metadata.featured_articles.length);
      articles = editorialData.metadata.featured_articles;
    } else {
      console.log("No featured articles in editorial, fetching directly");
    }

    if (editorialData.metadata?.featured_moods && Array.isArray(editorialData.metadata.featured_moods)) {
      moods = editorialData.metadata.featured_moods;
    }
  }

  // If we still don't have articles, fetch them directly
  if (articles.length === 0) {
    const articlesResponse = await getArticles({
      limit: 3,
      sort: "-metadata.date",
    });

    if (articlesResponse.objects) {
      console.log("Fetched articles directly:", articlesResponse.objects.length);
      articles = articlesResponse.objects;
    }
  }

  console.log("Final articles count:", articles.length);

  return (
    <div className="min-h-screen">
      {/* Main content */}
      <div className="container mx-auto pt-32 pb-32">
        {/* Gradient background for LATER section */}
        <div className="absolute top-0 bottom-0 right-0 w-1/2 bg-gradient-to-b from-tan-100 dark:from-black to-transparent z-0" />

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
                <div className="aspect-square w-full relative">
                  <Image src={currentShow?.image || "/placeholder.svg"} alt={currentShow?.title || "Current Show"} fill className="object-cover" />
                </div>
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 text-white">
                  <div className="flex justify-between items-start">
                    <div className="h-48">
                      <div className="text-xs font-medium rounded-full py-1 px-2 bg-black/20 inline-block mb-2">ON NOW</div>
                      <p className="text-sm text-bronze-100">{currentShow?.subtitle || ""}</p>
                      <h3 className="text-2xl text-bronze-50 font-bold mt-1">{currentShow?.title || "Loading show..."}</h3>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white px-4 py-2 text-sm flex items-center gap-2">
                    <Radio className="h-4 w-4 fill-current" /> Playing Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* UP NEXT */}
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-brand-orange mb-4">UP NEXT</h3>
              <div className="border-2 border-dotted border-brand-orange/40 p-4 flex items-center rounded-lg justify-between">
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
          <ClientSideSelectionWrapper featuredShows={featuredShows} />
        </div>

        {/* EDITORIAL section - now using our component */}
        <EditorialSection albumOfTheWeek={albumOfTheWeek} events={events} video={video} articles={articles} moods={moods} />
      </div>

      {/* Media player component */}
      <MediaPlayer currentShow={currentShow} />
    </div>
  );
}
