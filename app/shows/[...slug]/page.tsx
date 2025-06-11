import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getShowBySlug, getMixcloudShows } from "@/lib/actions";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { Button } from "@/components/ui/button";
import { PlayButton } from "@/components/play-button";
import { Card, CardContent } from "@/components/ui/card";
import { addHours, isWithinInterval } from "date-fns";
import { filterWorldwideFMTags } from "@/lib/mixcloud-service";
import ArchivePlayer from "@/components/archive-player";

// Add consistent revalidation time for Mixcloud content
export const revalidate = 900; // 15 minutes

// Generate static params for all shows
export async function generateStaticParams() {
  try {
    const { shows } = await getMixcloudShows();

    // Ensure we have a valid array of shows
    if (!shows || !Array.isArray(shows)) {
      console.log("No valid shows found for static params generation");
      return [];
    }

    console.log("Fetched shows:", shows.length);

    return shows
      .filter((show) => show && show.key) // Filter out any null/undefined shows or shows without keys
      .map((show) => {
        // Split the show key to get segments (remove empty segments)
        // For example: "/worldwidefm/show-name" => ["worldwidefm", "show-name"]
        const segments = show.key.split("/").filter(Boolean);
        return {
          slug: segments,
          show, // Pass the show data along with the params
        };
      });
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
}

// Type guard to check if the show is from RadioCult
function isRadioCultShow(show: any): boolean {
  return show && show.__source === "radiocult";
}

// Type guard to check if the show is a MixcloudShow
function isMixcloudShow(show: any): show is MixcloudShow {
  return show && show.key && show.pictures && show.tags && !show.__source;
}

export default async function ShowPage({ params }: { params: { slug: string[] } }) {
  // Convert the array of path segments back to a Mixcloud key format
  const showKey = "/" + params.slug.join("/");
  const showSlug = params.slug[params.slug.length - 1]; // Last segment for RadioCult slug
  console.log("Looking for show with key:", showKey);

  // Get the show data directly from getShowBySlug
  const rawShow = await getShowBySlug(showSlug);

  if (!rawShow) {
    console.error("Show not found for key:", showKey);
    notFound();
  }

  // The getShowBySlug function converts RadioCult events to a MixcloudShow-compatible format
  // So we can safely cast it as MixcloudShow with additional properties
  const show = rawShow as MixcloudShow & {
    __source?: string;
    endTime?: string;
    description?: string;
    showName?: string;
    imageUrl?: string;
    startTime?: string;
  };

  // Check if this is a RadioCult show
  const isRadioCult = show.__source === "radiocult";

  // Check if show is currently live
  const now = new Date();
  const startTime = new Date(show.created_time || show.startTime || "");
  const endTime = isRadioCult && show.endTime ? new Date(show.endTime) : addHours(startTime, 2); // Assume 2 hours for Mixcloud shows

  const isLive = isWithinInterval(now, { start: startTime, end: endTime });

  // Get related shows based on tags (only for Mixcloud shows)
  let relatedShows: MixcloudShow[] = [];
  if (!isRadioCult && show.tags) {
    const { shows: allShows } = await getMixcloudShows();

    // Find related shows based on matching tags
    const showTags = filterWorldwideFMTags(show.tags).map((tag) => tag.name.toLowerCase());
    relatedShows = allShows
      .filter(
        (s) =>
          s.key !== show.key && // Not the current show
          filterWorldwideFMTags(s.tags).some((tag) => showTags.includes(tag.name.toLowerCase())) // Has at least one matching tag
      )
      .slice(0, 3);
  }

  const displayName = show.name || show.showName || "Untitled Show";
  const displayImage = show.pictures?.extra_large || show.imageUrl || "/image-placeholder.svg";

  return (
    <div className="space-y-8">
      <Link href="/shows" className="text-foreground flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Shows
      </Link>

      <PageHeader title={displayName} description={isRadioCult ? show.description : undefined} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square relative">
          <Image src={displayImage} alt={displayName} fill className="object-cover rounded-lg" />
          {isLive && (
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-medium">LIVE</span>
            </div>
          )}
        </div>

        <div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Show Details</h3>
                <dd>{startTime.toLocaleDateString()}</dd>
                {isRadioCult && show.endTime && (
                  <dd className="mt-1">
                    {startTime.toLocaleTimeString()} - {new Date(show.endTime).toLocaleTimeString()}
                  </dd>
                )}
              </div>
              {!isLive && !isRadioCult && (
                <div>
                  <PlayButton show={show} variant="default" size="lg" isLive={false} className="w-max" label="Play Show" />
                </div>
              )}
            </div>

            {show.tags && show.tags.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {isRadioCult
                    ? // For RadioCult shows, tags might be strings
                      show.tags.map((tag: any) => (
                        <span key={typeof tag === "string" ? tag : tag.key} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm uppercase">
                          {typeof tag === "string" ? tag : tag.name}
                        </span>
                      ))
                    : // For Mixcloud shows, filter and use proper tag structure
                      filterWorldwideFMTags(show.tags).map((tag) => (
                        <span key={tag.key} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm uppercase">
                          {tag.name}
                        </span>
                      ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {relatedShows.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Related Shows</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedShows.map((relatedShow) => {
              const segments = relatedShow.key.split("/").filter(Boolean);
              return (
                <Link key={relatedShow.key} href={`/shows/${segments.join("/")}`}>
                  <Card className="overflow-hidden h-full hover:shadow-lg transition-all">
                    <div className="aspect-square relative">
                      <Image src={relatedShow.pictures.extra_large} alt={relatedShow.name} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                        <div className="p-4 w-full">
                          <h3 className="text-white font-medium line-clamp-2">{relatedShow.name}</h3>
                          {relatedShow.tags && relatedShow.tags.length > 0 && <p className="text-white/70 text-sm mt-1">{relatedShow.tags[0].name}</p>}
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <PlayButton show={relatedShow} size="icon" variant="secondary" className="opacity-80 hover:opacity-100" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* The players are now in the layout, so we don't need to render them here */}
    </div>
  );
}
