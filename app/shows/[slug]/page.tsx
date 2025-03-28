import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Calendar, Clock, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getShowBySlug, getAllShows } from "@/lib/actions";
import { transformShowToViewData } from "@/lib/cosmic-service";
import { notFound } from "next/navigation";

// Generate static params for all shows
export async function generateStaticParams() {
  const shows = await getAllShows();
  return shows.map((show) => ({
    slug: show.slug,
  }));
}

export default async function ShowPage({ params }: { params: { slug: string } }) {
  const show = await getShowBySlug(params.slug);

  if (!show) {
    notFound();
  }

  // Get related shows
  const allShows = await getAllShows();
  const relatedShows = allShows
    .filter((s) => s.slug !== params.slug)
    .slice(0, 3)
    .map(transformShowToViewData);

  return (
    <div className="min-h-screen">
      <div className=" mx-auto pt-32 pb-32">
        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-brand-orange transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/shows" className="hover:text-brand-orange transition-colors">
              Shows
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{show.title}</span>
          </div>
          <h1 className="text-3xl font-medium text-foreground">{show.title}</h1>
          <p className="text-muted-foreground mt-2">{show.subtitle}</p>
        </div>

        {/* Hero section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div className="aspect-square relative rounded-lg overflow-hidden">
            <Image src={show.image || "/placeholder.svg"} alt={show.title} fill className="object-cover" />
          </div>
          <div>
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Broadcast Time</h2>
                <p className="text-lg">{show.broadcast_time}</p>
              </div>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Day</h2>
                <p className="text-lg">{show.broadcast_day}</p>
              </div>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Duration</h2>
                <p className="text-lg">{show.duration}</p>
              </div>
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
              {relatedShows.map((relatedShow) => (
                <Link key={relatedShow.id} href={`/shows/${relatedShow.slug}`}>
                  <div className="group">
                    <div className="aspect-video relative rounded-lg overflow-hidden mb-4">
                      <Image src={relatedShow.image || "/placeholder.svg"} alt={relatedShow.title} fill className="object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <h3 className="font-medium group-hover:text-brand-orange transition-colors">{relatedShow.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{relatedShow.subtitle}</p>
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
