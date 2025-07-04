import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getMixcloudShows, getEnhancedShowBySlug } from "@/lib/actions";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { PlayButton } from "@/components/play-button";
import { Card } from "@/components/ui/card";
import { addHours, isWithinInterval } from "date-fns";
import { filterWorldwideFMTags } from "@/lib/mixcloud-service";
import { findHostSlug, displayNameToSlug } from "@/lib/host-matcher";

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
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
  const displayDescription = show.description || (isRadioCult ? show.description : undefined);

  return (
    <div className="space-y-8">
      <Link href="/shows" className="text-foreground flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Shows
      </Link>
      <PageHeader title={displayName} description={displayDescription} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square relative">
          <Image src={displayImage} alt={displayName} fill className="object-cover rounded-none" />
          {isLive && (
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-medium">LIVE</span>
            </div>
          )}
        </div>
        <div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-none">
            <div className="space-y-6">
              <div>
                <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-2">Show Details</h3>
                <dd>{startTime.toLocaleDateString()}</dd>
                {isRadioCult && show.endTime && (
                  <dd className="mt-1">
                    {startTime.toLocaleTimeString()} - {new Date(show.endTime).toLocaleTimeString()}
                  </dd>
                )}
                {(show as any).broadcast_time && <dd className="mt-1 text-sm text-muted-foreground">Broadcast: {(show as any).broadcast_time}</dd>}
                {(show as any).duration && <dd className="mt-1 text-sm text-muted-foreground">Duration: {(show as any).duration}</dd>}
              </div>
              {!isLive && !isRadioCult && (
                <div>
                  <PlayButton show={show} variant="default" size="lg" isLive={false} className="w-max" label="Play Show" />
                </div>
              )}
            </div>
            {/* Enhanced Hosts Section */}
            {((show as any).enhanced_hosts?.length > 0 || show.hosts?.length > 0 || (isRadioCult && (show as any).artists?.length > 0)) && (
              <div className="mt-8">
                <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-4">Hosts</h3>
                <div className="flex flex-wrap gap-2">
                  {(show as any).enhanced_hosts?.length > 0
                    ? (show as any).enhanced_hosts.map((host: any) => <HostLink key={host.id || host.key} host={host} className="bg-bronze-50 dark:bg-bronze-950 hover:bg-bronze-300 dark:hover:bg-bronze-900 text-bronze-900 dark:text-bronze-100 px-3 py-1 rounded-full text-sm transition-colors border border-bronze-300 dark:border-bronze-600" />)
                    : show.hosts?.map((host) => <HostLink key={host.key} host={host} className="bg-bronze-50 dark:bg-bronze-950 hover:bg-bronze-300 dark:hover:bg-bronze-900 text-bronze-900 dark:text-bronze-100 px-3 py-1 rounded-full text-sm transition-colors border border-bronze-300 dark:border-bronze-600" />)}
                  {isRadioCult && (show as any).artists?.map((artist: any) => <HostLink key={artist.id} host={artist} className="bg-bronze-50 dark:bg-bronze-950 hover:bg-bronze-300 dark:hover:bg-bronze-900 text-bronze-900 dark:text-bronze-100 px-3 py-1 rounded-full text-sm transition-colors border border-bronze-300 dark:border-bronze-600" />)}
                </div>
              </div>
            )}
            {/* Enhanced Genres Section */}
            {((show as any).enhanced_genres?.length > 0 || show.tags?.length > 0) && (
              <div className="mt-8">
                <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-4">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {(show as any).enhanced_genres?.map((genre: any) => (
                    <span key={genre.id || genre.key} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm uppercase">
                      {genre.title || genre.name}
                    </span>
                  )) ||
                    (isRadioCult
                      ? show.tags.map((tag: any) => (
                          <span key={typeof tag === "string" ? tag : tag.key} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm uppercase">
                            {typeof tag === "string" ? tag : tag.name}
                          </span>
                        ))
                      : filterWorldwideFMTags(show.tags).map((tag) => (
                          <span key={tag.key} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm uppercase">
                            {tag.name}
                          </span>
                        )))}
                </div>
              </div>
            )}
            {/* Locations Section */}
            {(show as any).locations?.length > 0 && (
              <div className="mt-8">
                <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-4">Locations</h3>
                <div className="flex flex-wrap gap-2">
                  {(show as any).locations.map((location: any) => (
                    <span key={location.id} className="bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full text-sm">
                      {location.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Takeovers Section */}
            {(show as any).takeovers?.length > 0 && (
              <div className="mt-8">
                <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-4">Takeovers</h3>
                <div className="flex flex-wrap gap-2">
                  {(show as any).takeovers.map((takeover: any) => (
                    <span key={takeover.id} className="bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded-full text-sm">
                      {takeover.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Additional Content Sections */}
      {((show as any).body_text || (show as any).tracklist) && (
        <div className="space-y-8">
          {(show as any).body_text && (
            <section className="bg-white dark:bg-gray-900 p-6 rounded-none">
              <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white mb-4">About This Show</h2>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">{(show as any).body_text}</p>
              </div>
            </section>
          )}
          {(show as any).tracklist && (
            <section className="bg-white dark:bg-gray-900 p-6 rounded-none">
              <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Tracklist</h2>
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{(show as any).tracklist}</pre>
              </div>
            </section>
          )}
        </div>
      )}
      {relatedShows.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">Related Shows</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedShows.map((relatedShow) => {
              const segments = relatedShow.key.split("/").filter(Boolean);
              let showPath = segments.join("/");
              if (showPath.startsWith("worldwidefm/")) {
                showPath = showPath.replace(/^worldwidefm\//, "");
              }
              return (
                <Link key={relatedShow.key} href={`/episode/${showPath}`}>
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
    </div>
  );
}
