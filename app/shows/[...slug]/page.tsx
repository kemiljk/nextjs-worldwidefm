import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { getShowBySlug, getMixcloudShows } from "@/lib/actions";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { Button } from "@/components/ui/button";
import { PlayButton } from "@/components/play-button";
import { Card, CardContent } from "@/components/ui/card";
import { addHours, isWithinInterval } from "date-fns";

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

export default async function ShowPage({ params }: { params: { slug: string[] } }) {
  // Convert the array of path segments back to a Mixcloud key format
  const showKey = "/" + params.slug.join("/");
  console.log("Looking for show with key:", showKey);

  // Get the show data directly from getShowBySlug
  const show = await getShowBySlug(showKey);

  if (!show) {
    console.error("Show not found for key:", showKey);
    notFound();
  }

  // Check if show is currently live (created within last 2 hours)
  const now = new Date();
  const startTime = new Date(show.created_time);
  const endTime = addHours(startTime, 2);
  const isLive = isWithinInterval(now, { start: startTime, end: endTime });

  // Get related shows based on tags
  const { shows: allShows } = await getMixcloudShows();

  // Find related shows based on matching tags
  const showTags = show.tags.map((tag) => tag.name.toLowerCase());
  const relatedShows = allShows
    .filter(
      (s) =>
        s.key !== show.key && // Not the current show
        s.tags.some((tag) => showTags.includes(tag.name.toLowerCase())) // Has at least one matching tag
    )
    .slice(0, 3); // Limit to 3 related shows

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/shows" className="text-bronze-500 hover:text-bronze-600 flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Shows
        </Link>
      </div>

      <PageHeader title={show.name} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-2">
          <div className="aspect-video relative mb-6 group">
            <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <PlayButton show={show} isLive={isLive} />
            </div>

            {/* Show live badge if the show is live */}
            {isLive && (
              <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium">LIVE</span>
              </div>
            )}
          </div>

          <div className="prose max-w-none dark:prose-invert">
            <h2>About this show</h2>
            <p>{show.name}</p>

            {show.tags.length > 0 && (
              <>
                <h3>Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {show.tags.map((tag) => (
                    <span key={tag.key} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                      {tag.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {show.hosts.length > 0 && (
              <>
                <h3>Hosts</h3>
                <div className="flex flex-wrap gap-2">
                  {show.hosts.map((host) => (
                    <span key={host.key} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                      {host.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white dark:bg-gray-900 p-6">
            <h3 className="text-lg mb-4">Show Details</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-gray-600 dark:text-gray-400">Air Date</dt>
                <dd>{new Date(show.created_time).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-gray-600 dark:text-gray-400">Duration</dt>
                <dd>{Math.floor(show.audio_length / 60)} minutes</dd>
              </div>
              <div>
                <dt className="text-gray-600 dark:text-gray-400">Play This Show</dt>
                <dd className="mt-2">
                  <PlayButton show={show} variant="default" size="lg" isLive={isLive} className="w-full" />
                </dd>
              </div>
              <div>
                <dt className="text-gray-600 dark:text-gray-400">Listen on Mixcloud</dt>
                <dd>
                  <a href={show.url} target="_blank" rel="noopener noreferrer" className="text-bronze-500 hover:text-bronze-600">
                    Open in Mixcloud
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Related Shows Section */}
      {relatedShows.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-semibold mb-6">Related Shows</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {relatedShows.map((relatedShow) => {
              // Convert the related show key to path segments for the link
              const segments = relatedShow.key.split("/").filter(Boolean);
              return (
                <Link key={relatedShow.key} href={`/shows/${segments.join("/")}`}>
                  <Card className="overflow-hidden h-full hover:shadow-lg transition-all">
                    <div className="aspect-video relative">
                      <Image src={relatedShow.pictures.extra_large} alt={relatedShow.name} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                        <div className="p-4 w-full">
                          <h3 className="text-white font-medium line-clamp-2">{relatedShow.name}</h3>
                          {relatedShow.tags && relatedShow.tags.length > 0 && <p className="text-white/70 text-sm mt-1">{relatedShow.tags[0].name}</p>}
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <PlayButton show={relatedShow} size="sm" variant="secondary" className="opacity-80 hover:opacity-100" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
