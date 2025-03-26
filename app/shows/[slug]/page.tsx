import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Calendar, Clock, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRadioShows, getRadioShowBySlug } from "@/lib/cosmic-service";
import { notFound } from "next/navigation";

// Generate static params for all shows
export async function generateStaticParams() {
  const showsResponse = await getRadioShows({ limit: 100 });
  const shows = showsResponse.objects || [];

  return shows.map((show) => ({
    slug: show.slug,
  }));
}

export default async function ShowPage({ params }: { params: { slug: string } }) {
  const showResponse = await getRadioShowBySlug(params.slug);
  const show = showResponse.objects?.[0];

  if (!show) {
    notFound();
  }

  // Get related/similar shows
  const relatedShowsResponse = await getRadioShows({
    limit: 5,
    exclude_ids: [show.id], // Exclude the current show
  });

  const relatedShows = relatedShowsResponse.objects || [];

  // Ensure we only display 5 shows
  const showsToDisplay = relatedShows.slice(0, 5);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto pt-32 pb-32">
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
        </div>

        {/* Show hero */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="aspect-square relative rounded-lg overflow-hidden">
            <Image src={show.metadata?.image?.imgix_url || "/placeholder.svg"} alt={show.title} fill className="object-cover" />
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <h1 className="text-4xl font-medium mb-2">{show.title}</h1>
              {show.metadata?.subtitle && <p className="text-xl text-muted-foreground mb-6">{show.metadata.subtitle}</p>}
              {show.metadata?.description && <p className="text-muted-foreground mb-8">{show.metadata.description}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {show.metadata?.broadcast_time && (
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-brand-orange mr-2" />
                    <div>
                      <p className="text-sm font-medium">Broadcast Time</p>
                      <p className="text-sm text-muted-foreground">{show.metadata.broadcast_time}</p>
                    </div>
                  </div>
                )}

                {show.metadata?.duration && (
                  <div className="flex items-center">
                    <Headphones className="h-5 w-5 text-brand-orange mr-2" />
                    <div>
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-sm text-muted-foreground">{show.metadata.duration}</p>
                    </div>
                  </div>
                )}

                {show.metadata?.broadcast_date && (
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-brand-orange mr-2" />
                    <div>
                      <p className="text-sm font-medium">Broadcast Date</p>
                      <p className="text-sm text-muted-foreground">{show.metadata.broadcast_date}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {show.metadata?.player && (
              <div className="mb-8">
                <div className="bg-white rounded-lg p-6">
                  <div dangerouslySetInnerHTML={{ __html: show.metadata.player }} />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {show.metadata?.player && <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white">Listen Now</Button>}
              <Button variant="outline" className="border-brand-orange text-brand-orange hover:bg-brand-orange/10">
                Add to Favorites
              </Button>
            </div>
          </div>
        </div>

        {/* Show content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            {show.metadata?.body_text && (
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: show.metadata.body_text }} />
              </div>
            )}
          </div>
          <div>
            {show.metadata?.tracklist && (
              <div className="bg-white rounded-lg p-6 mb-8">
                <h2 className="text-xl font-medium mb-4">Tracklist</h2>
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: show.metadata.tracklist }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related shows section */}
        {showsToDisplay.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-medium mb-6">Coming Up</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
              {showsToDisplay.map((relatedShow, index) => (
                <Link href={`/shows/${relatedShow.slug}`} key={index}>
                  <div className="group">
                    <div className="aspect-square relative rounded-lg overflow-hidden mb-3">
                      <Image src={relatedShow.metadata?.image?.imgix_url || "/placeholder.svg"} alt={relatedShow.title} fill className="object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <h3 className="font-medium group-hover:text-brand-orange transition-colors line-clamp-1">{relatedShow.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{relatedShow.metadata?.subtitle || ""}</p>
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
