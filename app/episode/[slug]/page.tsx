import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getEpisodeBySlug, getRelatedEpisodes, transformEpisodeToShowFormat } from "@/lib/episode-service";
import { EpisodeObject } from "@/lib/cosmic-types";
import { addHours, isWithinInterval } from "date-fns";
import { findHostSlug, displayNameToSlug } from "@/lib/host-matcher";
import { ShowCard } from "@/components/ui/show-card";
import { EpisodeHero } from "@/components/homepage-hero";
// stripUrlsFromText removed as we now render HTML content directly

export const revalidate = 900; // 15 minutes

export async function generateStaticParams() {
  try {
    // Note: We'll keep this simple for now since we're moving away from static generation
    // for episodes due to the large number of episodes
    return [];
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
}

export const dynamicParams = true;
export const dynamic = "force-dynamic";

async function HostLink({ host, className }: { host: any; className: string }) {
  let href = "#";
  let displayName = host.title || host.name;

  if (host.slug) {
    href = `/hosts/${host.slug}`;
  } else {
    const matchedSlug = await findHostSlug(displayName);
    if (matchedSlug) {
      href = `/hosts/${matchedSlug}`;
    } else {
      const fallbackSlug = displayNameToSlug(displayName);
      href = `/hosts/${fallbackSlug}`;
    }
  }

  return (
    <Link href={href} className={className}>
      {displayName}
    </Link>
  );
}

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: showSlug } = await params;

  // First try to get episode from Cosmic
  const episode = await getEpisodeBySlug(showSlug);

  if (!episode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh text-center">
        <h1 className="text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Episode Not Found</h1>
        <p className="text-lg text-muted-foreground mb-6">Sorry, we couldn't find an episode for this link. It may have been removed or does not exist.</p>
        <Link href="/shows" className="text-blue-600 hover:underline">
          Back to Shows
        </Link>
      </div>
    );
  }

  // Transform episode to show format for compatibility with existing components
  const show = transformEpisodeToShowFormat(episode);
  const metadata = episode.metadata || {};

  const now = new Date();
  const startTime = new Date(metadata.broadcast_date || episode.created_at);
  const endTime = addHours(startTime, 2); // Assume 2-hour episodes
  const isLive = isWithinInterval(now, { start: startTime, end: endTime });

  // Get related episodes based on genres and hosts
  const relatedEpisodes = await getRelatedEpisodes(episode, 3);
  const relatedShows = relatedEpisodes.map(transformEpisodeToShowFormat);

  const displayName = episode.title || "Untitled Episode";
  const displayImage = metadata.image?.imgix_url || "/image-placeholder.svg";

  // Format date for overlay (e.g., SAT 14/06)
  const showDate = startTime
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    })
    .replace(/\./g, "")
    .toUpperCase();

  return (
    <div className="pb-8 -mx-4 md:-mx-8 lg:-mx-16">
      <EpisodeHero displayName={displayName} displayImage={displayImage} showDate={showDate} show={show} />

      {/* Main Content Container */}
      <div className="mx-auto px-4 lg:px-8 mt-8">
        <div className="flex gap-8">
          <div className="max-w-3xl mx-auto">
            {/* Episode Description */}
            {(metadata.body_text || metadata.description) && (
              <div className="mb-4">
                <div className="prose dark:prose-invert max-w-none">
                  <div
                    className="text-b2 text-muted-foreground leading-tight"
                    dangerouslySetInnerHTML={{
                      __html: metadata.body_text || metadata.description || "",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Episode Details */}
            <div className="space-y-6">
              {/* Genres Section */}
              {metadata.genres?.length > 0 && (
                <div>
                  <div className="flex flex-wrap select-none cursor-default gap-2">
                    {metadata.genres.map((genre: any) => (
                      <span key={genre.id || genre.slug} className="border border-almostblack dark:border-white px-3 py-1.5 rounded-full text-sm uppercase tracking-wide font-mono">
                        {genre.title || genre.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hosts Section */}
              {metadata.regular_hosts?.length > 0 && (
                <div>
                  <h3 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Hosts</h3>
                  <div className="flex flex-wrap gap-2">
                    {metadata.regular_hosts.map((host: any) => (
                      <HostLink key={host.id || host.slug} host={host} className="text-b3 text-muted-foreground hover:text-foreground transition-colors" />
                    ))}
                  </div>
                </div>
              )}

              {/* Duration */}
              {metadata.duration && (
                <div>
                  <span className="text-sm text-muted-foreground">Duration: {metadata.duration}</span>
                </div>
              )}

              {/* Broadcast Info */}
              {metadata.broadcast_date && (
                <div>
                  <span className="text-sm text-muted-foreground">
                    Broadcast: {new Date(metadata.broadcast_date).toLocaleDateString()}
                    {metadata.broadcast_time && ` at ${metadata.broadcast_time}`}
                  </span>
                </div>
              )}

              {/* Tracklist Section */}
              {metadata.tracklist && (
                <div className="mt-12">
                  <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white mb-6">Tracklist</h2>
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="text-b4 text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: metadata.tracklist }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            {/* Related Episodes Section */}
            {relatedShows.length > 0 && (
              <div>
                <h2 className="font-aircompressed text-[40px] uppercase tracking-tight leading-[0.9] text-black mb-6 w-full" style={{ fontFamily: "AirCompressed-Black, sans-serif" }}>
                  RELATED EPISODES
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-2">
                  {relatedShows.map((relatedShow) => {
                    const slug = `/episode/${relatedShow.slug}`;
                    return <ShowCard key={relatedShow.id || relatedShow.slug} show={relatedShow} slug={slug} playable />;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
