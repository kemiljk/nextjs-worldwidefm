import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAllShows } from "@/lib/actions";
import { transformShowToViewData } from "@/lib/cosmic-service";

export default async function ShowsPage() {
  // Get all shows using server action
  const shows = await getAllShows();
  const transformedShows = shows.map(transformShowToViewData);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {transformedShows.map((show) => (
            <Card key={show.id} className="overflow-hidden border-none shadow-md">
              <CardContent className="p-0 relative">
                <div className="aspect-square relative">
                  <Image src={show.image || "/placeholder.svg"} alt={show.title} fill className="object-cover" />
                </div>
                <div className="p-4">
                  <h3 className="font-medium line-clamp-1">{show.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{show.description || ""}</p>
                  <div className="flex justify-between items-center mt-4">
                    <Link href={`/shows/${show.slug}`} className="text-sm text-brand-orange hover:underline">
                      View Details
                    </Link>
                    <Button size="sm" variant="ghost" className="text-brand-orange hover:bg-brand-orange/10 rounded-full p-2">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
