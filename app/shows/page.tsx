import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRadioShows } from "@/lib/cosmic-service";

export default async function ShowsPage() {
  // Get all shows
  const showsResponse = await getRadioShows({
    limit: 20,
    sort: "title", // Alphabetical order
  });

  const allShows = showsResponse.objects || [];

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
            <span className="text-foreground">Shows</span>
          </div>
          <h1 className="text-3xl font-medium text-foreground">Our Shows</h1>
          <p className="text-muted-foreground mt-2">Discover all our current radio shows and programs.</p>
        </div>

        {/* Shows grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allShows.length > 0 ? (
            allShows.map((show, index) => (
              <Link href={`/shows/${show.slug}`} key={index}>
                <Card className="overflow-hidden border-none shadow-md transition-transform hover:scale-[1.02] h-full">
                  <CardContent className="p-0 relative h-full flex flex-col">
                    <div className="aspect-video relative">
                      <Image src={show.metadata?.image?.imgix_url || "/placeholder.svg"} alt={show.title || "Show"} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="text-xl font-medium">{show.title || "Untitled Show"}</h3>
                        <p className="text-sm opacity-90 mt-1">{show.metadata?.subtitle || ""}</p>
                      </div>
                    </div>
                    <div className="p-5 flex-grow">
                      <p className="text-sm text-muted-foreground line-clamp-3">{show.metadata?.description || "No description available."}</p>
                      {show.metadata?.broadcast_time && <p className="mt-4 text-xs font-medium text-brand-orange">{show.metadata.broadcast_time}</p>}
                    </div>
                    <div className="p-4 border-t border-muted/40 flex justify-between items-center">
                      <span className="text-sm font-medium text-brand-orange">View Details</span>
                      <ChevronRight className="h-4 w-4 text-brand-orange" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">No shows available at the moment.</p>
              <Link href="/">
                <Button variant="outline" className="text-brand-orange border-brand-orange hover:bg-brand-orange/10">
                  Back to Home
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
