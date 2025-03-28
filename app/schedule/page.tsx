import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSchedule } from "@/lib/cosmic-service";

export default async function SchedulePage() {
  // Get the schedule data
  const scheduleResponse = await getSchedule();

  // Extract schedule items if available
  const scheduleItems = scheduleResponse.object?.metadata?.shows || [];

  return (
    <div className="min-h-screen">
      <div className=" mx-auto pt-32 pb-32">
        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-crimson transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Schedule</span>
          </div>
          <h1 className="text-4xl font-medium text-foreground mb-2">Weekly Schedule</h1>
          <p className="text-lg text-muted-foreground">Tune in to our shows throughout the week.</p>
        </div>

        {/* Schedule list */}
        <div className="bg-background rounded-none shadow-sm overflow-hidden">
          {scheduleItems.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {scheduleItems.map((show) => (
                <Link href={`/shows/${show.slug}`} key={show.id} className="flex items-center gap-4 p-4 hover:bg-bronze-50 dark:hover:bg-bronze-900 transition-colors group">
                  {/* Show thumbnail */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-none overflow-hidden">
                    <img src={show.metadata?.image?.imgix_url || "/placeholder.svg"} alt={show.title} className="object-cover w-full h-full" />
                  </div>

                  {/* Show info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg leading-tight  font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand-orange transition-colors">{show.title}</h3>
                    {show.metadata?.subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{show.metadata.subtitle}</p>}
                    {show.metadata?.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{show.metadata.description}</p>}
                  </div>

                  {/* Action button */}
                  <div className="flex-shrink-0">
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-600 group-hover:text-brand-orange transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-muted-foreground mb-4">No scheduled shows available at the moment.</p>
              <Link href="/">
                <Button variant="outline" className="text-crimson border-crimson hover:bg-crimson/10">
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
