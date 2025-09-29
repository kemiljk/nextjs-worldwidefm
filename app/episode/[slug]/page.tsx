import { Metadata } from "next";
import Link from "next/link";
import { getEpisodeBySlug, getRelatedEpisodes, transformEpisodeToShowFormat } from "@/lib/episode-service";
import { addHours, isWithinInterval } from "date-fns";
import { findHostSlug, displayNameToSlug } from "@/lib/host-matcher";
import { ShowCard } from "@/components/ui/show-card";
import { EpisodeHero } from "@/components/homepage-hero";
import { SafeHtml } from "@/components/ui/safe-html";
import { GenreTag } from "@/components/ui/genre-tag";
import { generateShowMetadata } from "@/lib/metadata-utils";
import { TracklistToggle } from "@/components/ui/tracklisttoggle";

// stripUrlsFromText removed as we now render HTML content directly

export const revalidate = 900; // 15 minutes

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const episode = await getEpisodeBySlug(slug);

    if (episode) {
      return generateShowMetadata(episode);
    }

    return generateShowMetadata({ title: "Episode Not Found" });
  } catch (error) {
    console.error("Error generating episode metadata:", error);
    return generateShowMetadata({ title: "Episode Not Found" });
  }
}

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
  const displayImage = metadata.image?.imgix_url || "/image-placeholder.png";

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
    <div className="pb-50">
      <EpisodeHero displayName={displayName} displayImage={displayImage} showDate={showDate} show={show} />

      {/* Main Content Container */}

      <div className="w-full flex flex-col md:flex-row justify-between gap-8 px-5 pt-3">
        {/*LEFT CONTAINER*/}
        <div className="w-full md:w-[40%] flex flex-col gap-1">
          {/* Episode Description */}
          {(metadata.body_text || metadata.description) && (
            <div className="prose dark:prose-invert max-w-none">
              <SafeHtml content={metadata.body_text || metadata.description || ""} type="editorial" className="text-b3 sm:text-[18px] leading-tight text-almostblack" />
            </div>
          )}

          {/* Genres Section */}
          {metadata.genres?.length > 0 && (
            <div>
              <div className="flex flex-wrap select-none cursor-default my-3">
                {metadata.genres.map((genre: any) => (
                  <GenreTag key={genre.id || genre.slug}>{genre.title || genre.name}</GenreTag>
                ))}
              </div>
            </div>
          )}
          {/* Hosts Section */}
          {metadata.regular_hosts?.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-1">
              {metadata.regular_hosts.map((host: any) => (
                <HostLink key={host.id || host.slug} host={host} className="text-m7 font-mono uppercase text-muted-foreground hover:text-foreground transition-colors" />
              ))}
            </div>
          )}

          {/* Duration */}
          {metadata.duration && (
            <div>
              <span className="text-m7 font-mono pl-1 uppercase text-muted-foreground hover:text-foreground transition-colors">Duration: {metadata.duration}</span>
            </div>
          )}

          {/* Broadcast Info */}
          {metadata.broadcast_date && (
            <div>
              <span className="text-m7 font-mono pl-1 uppercase text-muted-foreground hover:text-foreground transition-colors">
                Broadcast: {new Date(metadata.broadcast_date).toLocaleDateString()}
                {metadata.broadcast_time && ` at ${metadata.broadcast_time}`}
              </span>
            </div>
          )}

          {/* Tracklist Section */}
          <div className="my-4">{metadata.tracklist && <TracklistToggle tracklist={metadata.tracklist} />}</div>
        </div>

        {/*RIGHT CONTAINER*/}
        <div className="w-full md:w-[60%] flex flex-col mt-2 gap-2 h-auto">
          {relatedShows.length > 0 && (
            <div>
              <h2 className="text-h8 md:text-h7 font-bold tracking-tight">RELATED EPISODES</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 justify-between pt-3">
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
  );
}
