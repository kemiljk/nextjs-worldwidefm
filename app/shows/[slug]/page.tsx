import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getShowBySlug, getAllShows } from "@/lib/actions";
import { transformShowToViewData } from "@/lib/cosmic-service";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";

// Generate static params for all shows
export async function generateStaticParams() {
  const shows = await getAllShows();
  return shows.map((show) => ({
    slug: show.slug,
  }));
}

export default async function ShowPage({ params }: { params: { slug: string } }) {
  // Await the entire params object first
  const resolvedParams = await params;

  // Get the current show first
  const [showData, allShowsData] = await Promise.all([getShowBySlug(resolvedParams.slug), getAllShows()]);

  if (!showData) {
    notFound();
  }

  // Keep the show data for template usage
  const show = showData;

  // Transform all shows data
  const allShows = allShowsData.map(transformShowToViewData);

  // Get related shows based on matching genres
  const relatedShows = allShows
    .filter((s) => {
      // Don't include the current show
      if (s.slug === resolvedParams.slug) return false;

      // Get genres from both shows, ensuring they exist
      const currentGenres = show.genres || [];
      const otherGenres = s.genres || [];

      // Only proceed if both shows have genres
      if (!currentGenres?.length || !otherGenres?.length) return false;

      // Check if there's at least one matching genre
      return currentGenres.some((genre) => genre?.slug && otherGenres.some((otherGenre) => otherGenre?.slug === genre.slug));
    })
    .slice(0, 3);

  return (
    <div className="min-h-screen">
      <div className="mx-auto pt-32 pb-32">
        <PageHeader title={show.title} description={show.subtitle} breadcrumbs={[{ href: "/", label: "Home" }, { href: "/shows", label: "Shows" }, { label: show.title }]} />

        {/* Hero section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div className="aspect-square relative rounded-lg overflow-hidden">
            <Image src={show.image} alt={show.title} fill className="object-cover" />
          </div>
          <div>
            {/* Show metadata */}
            <div className="space-y-4 mb-8">
              {show.broadcast_time && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Broadcast Time</h2>
                  <p className="text-lg">{show.broadcast_time}</p>
                </div>
              )}
              {show.broadcast_day && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Day</h2>
                  <p className="text-lg">{show.broadcast_day}</p>
                </div>
              )}
              {show.duration && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Duration</h2>
                  <p className="text-lg">{show.duration}</p>
                </div>
              )}
            </div>

            {/* Additional metadata */}
            <div className="space-y-4">
              {show.genres && show.genres.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Genres</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {show.genres.map((genre, index) => (
                      <span key={`genre-${genre.slug}-${index}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-bronze-100 text-bronze-800 dark:bg-bronze-900 dark:text-bronze-100">
                        {genre.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {show.locations && show.locations.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Locations</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {show.locations.map((location, index) => (
                      <span key={`location-${location.slug}-${index}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-bronze-100 text-bronze-800 dark:bg-bronze-900 dark:text-bronze-100">
                        {location.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {show.regular_hosts && show.regular_hosts.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Hosts</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {show.regular_hosts.map((host, index) => (
                      <span key={`host-${host.slug}-${index}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-bronze-100 text-bronze-800 dark:bg-bronze-900 dark:text-bronze-100">
                        {host.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {show.takeovers && show.takeovers.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Takeovers</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {show.takeovers.map((takeover, index) => (
                      <span key={`takeover-${takeover.slug}-${index}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-bronze-100 text-bronze-800 dark:bg-bronze-900 dark:text-bronze-100">
                        {takeover.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {show.player && (
              <div className="mt-8">
                <h2 className="text-sm font-medium text-muted-foreground mb-4">Listen Now</h2>
                <div className="aspect-video relative">
                  <iframe src={show.player} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {show.description && (
          <div className="prose prose-sm max-w-none mb-16">
            <div dangerouslySetInnerHTML={{ __html: show.description }} />
          </div>
        )}

        {/* Body text */}
        {show.body_text && (
          <div className="prose prose-sm max-w-none mb-16">
            <div dangerouslySetInnerHTML={{ __html: show.body_text }} />
          </div>
        )}

        {/* Tracklist */}
        {show.tracklist && (
          <div className="mb-16">
            <h2 className="text-2xl font-medium mb-4">Tracklist</h2>
            <div className="prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: show.tracklist }} />
            </div>
          </div>
        )}

        {/* Related shows */}
        {relatedShows.length > 0 && (
          <div>
            <h2 className="text-2xl font-medium mb-6">Related Shows</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedShows.map((relatedShow, showIndex) => (
                <Link key={`show-${relatedShow.slug}-${showIndex}`} href={`/shows/${relatedShow.slug}`}>
                  <div className="group">
                    <div className="aspect-video relative rounded-lg overflow-hidden mb-4">
                      <Image src={relatedShow.image} alt={relatedShow.title} fill className="object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <h3 className="font-medium group-hover:text-brand-orange transition-colors">{relatedShow.title}</h3>
                    {relatedShow.subtitle && <p className="text-sm text-muted-foreground mt-1">{relatedShow.subtitle}</p>}

                    {/* Show metadata tags */}
                    <div className="space-y-2 mt-3">
                      {relatedShow.genres && relatedShow.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {relatedShow.genres.map((genre, index) => (
                            <span key={`related-genre-${genre.slug}-${showIndex}-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-bronze-100 text-bronze-800 dark:bg-bronze-900 dark:text-bronze-100">
                              {genre.title}
                            </span>
                          ))}
                        </div>
                      )}
                      {relatedShow.locations && relatedShow.locations.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {relatedShow.locations.map((location, index) => (
                            <span key={`related-location-${location.slug}-${showIndex}-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-bronze-100/80 text-bronze-800 dark:bg-bronze-900/80 dark:text-bronze-100">
                              {location.title}
                            </span>
                          ))}
                        </div>
                      )}
                      {relatedShow.regular_hosts && relatedShow.regular_hosts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {relatedShow.regular_hosts.map((host, index) => (
                            <span key={`related-host-${host.slug}-${showIndex}-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-bronze-100/60 text-bronze-800 dark:bg-bronze-900/60 dark:text-bronze-100">
                              {host.title}
                            </span>
                          ))}
                        </div>
                      )}
                      {relatedShow.takeovers && relatedShow.takeovers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {relatedShow.takeovers.map((takeover, index) => (
                            <span key={`related-takeover-${takeover.slug}-${showIndex}-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-bronze-100/40 text-bronze-800 dark:bg-bronze-900/40 dark:text-bronze-100">
                              {takeover.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
