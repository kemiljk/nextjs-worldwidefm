import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getMixcloudShows, getEnhancedShowBySlug } from "@/lib/actions";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { addHours, isWithinInterval } from "date-fns";
import { filterWorldwideFMTags } from "@/lib/mixcloud-service";
import { findHostSlug, displayNameToSlug } from "@/lib/host-matcher";
import { ShowCard } from "@/components/ui/show-card";
import { EpisodeHero } from "@/components/homepage-hero";
import { stripUrlsFromText } from "@/lib/utils";

export const revalidate = 900; // 15 minutes

export async function generateStaticParams() {
  try {
    const { shows } = await getMixcloudShows({ limit: 100 });
    if (!shows || !Array.isArray(shows)) {
      console.log("No valid shows found for static params generation");
      return [];
    }
    return shows
      .filter((show) => show && show.key)
      .map((show) => {
        const segments = show.key.split("/").filter(Boolean);
        return { slug: segments[segments.length - 1] };
      });
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

export default async function EpisodePage({ params }: { params: { slug: string } }) {
  const showSlug = params.slug;
  const rawShow = await getEnhancedShowBySlug(showSlug);
  if (!rawShow) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh text-center">
        <h1 className="text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Show Not Found</h1>
        <p className="text-lg text-muted-foreground mb-6">Sorry, we couldn't find a show for this link. It may have been removed or does not exist.</p>
        <Link href="/shows" className="text-blue-600 hover:underline">
          Back to Shows
        </Link>
      </div>
    );
  }

  const show = rawShow as MixcloudShow & {
    __source?: string;
    endTime?: string;
    description?: string;
    showName?: string;
    imageUrl?: string;
    startTime?: string;
  };

  const isRadioCult = show.__source === "radiocult";
  const now = new Date();
  const startTime = new Date(show.created_time || show.startTime || "");
  const endTime = isRadioCult && show.endTime ? new Date(show.endTime) : addHours(startTime, 2);
  const isLive = isWithinInterval(now, { start: startTime, end: endTime });

  let relatedShows: MixcloudShow[] = [];
  if (!isRadioCult && show.tags) {
    const { shows: allShows } = await getMixcloudShows();
    const showTags = filterWorldwideFMTags(show.tags).map((tag) => tag.name.toLowerCase());
    relatedShows = allShows.filter((s) => s.key !== show.key && filterWorldwideFMTags(s.tags).some((tag) => showTags.includes(tag.name.toLowerCase()))).slice(0, 3);
  }

  const displayName = show.name || show.showName || "Untitled Show";
  const displayImage = (show as any).enhanced_image || show.pictures?.extra_large || show.imageUrl || "/image-placeholder.svg";

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
      <EpisodeHero displayName={displayName} displayImage={displayImage} showDate={showDate} playable={!isLive && !isRadioCult} show={show} />
      {/* Main Content Container */}
      <div className="mx-auto px-4 lg:px-8 mt-8">
        <div className="flex gap-8">
          <div className="max-w-3xl mx-auto">
            {/* Show Description */}
            {((show as any).body_text || show.description) && (
              <div className="mb-4">
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-b2 text-muted-foreground leading-tight">{(show as any).body_text || stripUrlsFromText(show.description || "")}</p>
                </div>
              </div>
            )}

            {/* Show Details */}
            <div className="space-y-6">
              {/* Genres Section */}
              {((show as any).enhanced_genres?.length > 0 || show.tags?.length > 0) && (
                <div>
                  <div className="flex flex-wrap select-none cursor-default">
                    {(show as any).enhanced_genres?.map((genre: any) => (
                      <span key={genre.id || genre.key} className="border border-almostblack dark:border-white px-3 py-1.5 rounded-full text-sm uppercase tracking-wide font-mono">
                        {genre.title || genre.name}
                      </span>
                    )) ||
                      (isRadioCult
                        ? show.tags.map((tag: any) => (
                            <span key={typeof tag === "string" ? tag : tag.key} className="border border-almostblack dark:border-white px-3 py-1.5 rounded-full text-sm uppercase tracking-wide font-mono">
                              {typeof tag === "string" ? tag : tag.name}
                            </span>
                          ))
                        : filterWorldwideFMTags(show.tags).map((tag) => (
                            <span key={tag.key} className="border border-almostblack dark:border-white px-3 py-1.5 rounded-full text-sm uppercase tracking-wide font-mono">
                              {tag.name}
                            </span>
                          )))}
                  </div>
                </div>
              )}

              {/* Tracklist Section */}
              {(show as any).tracklist && (
                <div className="mt-12">
                  <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white mb-6">Tracklist</h2>
                  <div className="prose dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-b4 text-muted-foreground leading-relaxed">{(show as any).tracklist}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            {/* Related Shows Section */}
            {relatedShows.length > 0 && (
              <div>
                <h2 className="font-aircompressed text-[40px] uppercase tracking-tight leading-[0.9] text-black mb-6 w-full" style={{ fontFamily: "AirCompressed-Black, sans-serif" }}>
                  RELATED SHOWS
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-2">
                  {relatedShows.map((relatedShow) => {
                    const segments = relatedShow.key.split("/").filter(Boolean);
                    let showPath = segments.join("/");
                    if (showPath.startsWith("worldwidefm/")) {
                      showPath = showPath.replace(/^worldwidefm\//, "");
                    }
                    const slug = `/episode/${showPath}`;
                    return <ShowCard key={relatedShow.key} show={relatedShow} slug={slug} playable={true} />;
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
