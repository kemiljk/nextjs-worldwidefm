import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSchedule } from "@/lib/cosmic-service";

export default async function SchedulePage() {
  // Get the schedule data
  const scheduleResponse = await getSchedule();

  // Extract schedule items if available
  const scheduleItems = (scheduleResponse.objects && scheduleResponse.objects[0]?.metadata?.shows) || [];

  // Group schedule items by day
  const groupedSchedule: Record<string, any[]> = {};

  scheduleItems.forEach((show: any) => {
    // Default to "FRIDAY" instead of "UNKNOWN" if no broadcast day is specified
    const day = show.metadata?.broadcast_day || "FRIDAY";
    if (!groupedSchedule[day]) {
      groupedSchedule[day] = [];
    }
    groupedSchedule[day].push(show);
  });

  // Sort days in week order
  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const sortedDays = Object.keys(groupedSchedule).sort((a, b) => {
    return dayOrder.indexOf(a) - dayOrder.indexOf(b);
  });

  return (
    <div className="min-h-screen bg-brand-beige">
      <div className="container mx-auto pt-32 pb-32">
        {/* Header with breadcrumb */}
        <div className="mb-12">
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

        {/* Schedule rows */}
        {sortedDays.length > 0 ? (
          sortedDays.map((day) => (
            <div key={day} className="mb-16">
              <h2 className="text-2xl font-medium mb-5 text-crimson uppercase tracking-wide border-b border-crimson/20 pb-2">{day}</h2>
              <div className="bg-brand-beige overflow-hidden">
                {groupedSchedule[day].map((show, index) => (
                  <div key={index} className={`flex border-b border-gray-200 ${index === groupedSchedule[day].length - 1 ? "border-b-0" : ""} hover:bg-white/50 transition-colors`}>
                    {/* Time slot */}
                    <div className="w-40 flex-shrink-0 py-5 px-4 flex flex-col justify-center border-r border-gray-200">
                      <p className="text-xl font-medium text-crimson">{show.metadata?.broadcast_time?.split(" - ")[0] || "00:00"}</p>
                      <p className="text-sm text-gray-500">- {show.metadata?.broadcast_time?.split(" - ")[1] || "00:00"}</p>
                    </div>

                    {/* Show details */}
                    <div className="flex flex-1 items-center p-5">
                      {/* Show image */}
                      <div className="w-20 h-20 relative flex-shrink-0 mr-5">
                        <Image src={show.metadata?.image?.imgix_url || "/placeholder.svg"} alt={show.title || "Show"} fill className="object-cover rounded-sm" />
                      </div>

                      {/* Show info */}
                      <div className="flex-1">
                        <h3 className="text-xl font-medium text-gray-900">{show.title || "Upcoming Show"}</h3>
                        <p className="text-base text-gray-500 mt-1 line-clamp-1">{show.metadata?.subtitle || ""}</p>
                        {show.metadata?.duration && <p className="text-sm text-crimson mt-1">{show.metadata.duration}</p>}
                      </div>

                      {/* Action buttons */}
                      <div className="flex-shrink-0 ml-4 flex items-center gap-3">
                        <Button size="sm" className="bg-crimson hover:bg-crimson/90 text-white rounded-full w-12 h-12 p-0">
                          <Play className="h-6 w-6 fill-current" />
                        </Button>
                        {show.slug && (
                          <Link href={`/shows/${show.slug}`}>
                            <Button variant="outline" className="text-crimson border-crimson hover:bg-crimson/10 h-10">
                              Show Details
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
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
  );
}
