import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getRadioShows } from "@/lib/cosmic-service";

export default async function ArchivePage() {
  // Get the archived shows
  const showsResponse = await getRadioShows({
    limit: 12,
    sort: "-created_at", // Sort by most recent first
  });

  const archivedShows = showsResponse.objects || [];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto pt-32 pb-32">
        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-crimson transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Archive</span>
          </div>
          <h1 className="text-3xl font-medium text-foreground">Show Archive</h1>
          <p className="text-muted-foreground mt-2">Explore our collection of past broadcasts and shows.</p>
        </div>

        {/* Search and filter bar */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Search shows" className="pl-10 bg-white border-none focus-visible:ring-crimson" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="text-crimson border-crimson hover:bg-crimson/10">
              All Shows
            </Button>
            <Button variant="outline" className="text-muted-foreground border-muted hover:bg-muted/10">
              Featured
            </Button>
            <Button variant="outline" className="text-muted-foreground border-muted hover:bg-muted/10">
              Recent
            </Button>
          </div>
        </div>

        {/* Archive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {archivedShows.length > 0 ? (
            archivedShows.map((show, index) => (
              <Card key={index} className="overflow-hidden border-none shadow-md">
                <CardContent className="p-0 relative">
                  <div className="aspect-square relative">
                    <Image src={show.metadata?.image?.imgix_url || "/placeholder.svg"} alt={show.title || "Show"} fill className="object-cover" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium line-clamp-1">{show.title || "Untitled Show"}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{show.metadata?.subtitle || ""}</p>
                    <p className="text-xs text-muted-foreground mt-3 mb-3">
                      {(show as any).published_at
                        ? new Date((show as any).published_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "No date available"}
                    </p>
                    <div className="flex justify-between items-center">
                      <Link href={`/shows/${show.slug}`} className="text-sm text-crimson hover:underline">
                        View Details
                      </Link>
                      <Button size="sm" variant="ghost" className="text-crimson hover:bg-crimson/10 rounded-full p-2">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">No archived shows available at the moment.</p>
              <Link href="/">
                <Button variant="outline" className="text-crimson border-crimson hover:bg-crimson/10">
                  Back to Home
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Pagination */}
        {archivedShows.length > 0 && (
          <div className="mt-12 flex justify-center">
            <div className="flex gap-2">
              <Button variant="outline" className="text-muted-foreground border-muted hover:bg-muted/10" disabled>
                Previous
              </Button>
              <Button variant="outline" className="text-crimson border-crimson hover:bg-crimson/10 min-w-[40px]">
                1
              </Button>
              <Button variant="outline" className="text-muted-foreground border-muted hover:bg-muted/10 min-w-[40px]">
                2
              </Button>
              <Button variant="outline" className="text-muted-foreground border-muted hover:bg-muted/10 min-w-[40px]">
                3
              </Button>
              <Button variant="outline" className="text-muted-foreground border-muted hover:bg-muted/10">
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
