import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRadioShows, getSchedule, transformShowToViewData, getEditorialHomepage, getArticles, getWatchAndListenItems, getPosts } from "@/lib/cosmic-service";

// Keep the mock data for editorial content for now
import ClientSideSelectionWrapper from "@/components/client-side-selection-wrapper";
import MediaPlayer from "@/components/media-player";
import EditorialSection from "@/components/editorial/editorial-section";
import { ArticleObject, WatchAndListenObject, MoodObject, PostObject } from "@/lib/cosmic-config";

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

  let featuredShows: ReturnType<typeof transformShowToViewData>[] = [];

  // If we have schedule data, use the shows from the schedule
  if (scheduleResponse.objects && scheduleResponse.objects[0]?.metadata?.shows) {
    const scheduleShows = scheduleResponse.objects[0].metadata.shows;
    // Skip the first two shows (current and upcoming) and use the rest for featured shows
    featuredShows = scheduleShows.slice(2).map(transformShowToViewData);
  }

  // If we don't have enough shows from the schedule, add some from the radio shows
  if (featuredShows.length < 5) {
    const radioShows = showsResponse.objects ? showsResponse.objects.map(transformShowToViewData) : [];

    // Filter out any shows that are already in featuredShows
    const additionalShows = radioShows.filter((show) => !featuredShows.some((featured) => featured.id === show.id));

    // Add additional shows until we have 5 total
    featuredShows = [...featuredShows, ...additionalShows].slice(0, 7);
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

  // Fetch editorial content from Cosmic
  const editorialResponse = await getEditorialHomepage();

  // Set up default empty arrays/nulls for editorial content
  let posts: PostObject[] = [];
  let moods: MoodObject[] = [];

  // Parse the editorial content if it exists
  if (editorialResponse.object) {
    const editorialData = editorialResponse.object;

    // Get featured posts and moods
    if (editorialData.metadata?.featured_posts && Array.isArray(editorialData.metadata.featured_posts)) {
      posts = editorialData.metadata.featured_posts;
      console.log(`Found ${posts.length} featured posts in editorial homepage`);
    }

    if (editorialData.metadata?.featured_moods && Array.isArray(editorialData.metadata.featured_moods)) {
      moods = editorialData.metadata.featured_moods;
    }
  }

  // If we don't have enough posts, fetch more
  if (posts.length < 6) {
    console.log(`Fetching additional posts to reach 6 total (currently have ${posts.length})`);
    const postsResponse = await getPosts({
      limit: 6 - posts.length,
      sort: "-metadata.date",
      featured: true,
    });

    if (postsResponse.objects && postsResponse.objects.length > 0) {
      console.log(`Fetched ${postsResponse.objects.length} additional posts`);
      posts = [...posts, ...postsResponse.objects];
    } else {
      console.log("No additional posts found");
    }
  }

  // If we still don't have any posts, try fetching without the featured filter
  if (posts.length === 0) {
    console.log("No posts found with featured filter, trying without filter");
    const postsResponse = await getPosts({
      limit: 6,
      sort: "-metadata.date",
    });

    if (postsResponse.objects && postsResponse.objects.length > 0) {
      console.log(`Fetched ${postsResponse.objects.length} posts without featured filter`);
      posts = postsResponse.objects;
    }
  }

  console.log(`Final posts count: ${posts.length}`);

  return (
    <div className="min-h-screen">
      {/* Main content */}
      <div className="mx-auto pt-32 pb-32">
        {/* Gradient background for LATER section */}
        <div className="absolute top-0 bottom-0 right-0 w-1/2 bg-gradient-to-b from-tan-50/30 dark:from-black/20 to-transparent -z-10" />

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
              <div className="border-2 border-brand-orange/40 p-4 flex items-center rounded-lg justify-between">
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
          <ClientSideSelectionWrapper featuredShows={featuredShows} title="COMING UP" />
        </div>

        {/* EDITORIAL section - now using our unified posts approach */}
        <EditorialSection posts={posts} className="mt-24" />
      </div>

      {/* Media player component */}
      <MediaPlayer currentShow={currentShow} />
    </div>
  );
}
