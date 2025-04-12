import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSchedule } from "@/lib/cosmic-service";
import { PageHeader } from "@/components/shared/page-header";

interface ScheduleShow {
  show_key: string;
  show_time: string;
  show_day: string;
  name: string;
  url: string;
  picture: string;
  created_time: string;
  tags: string[];
  hosts: string[];
  duration: number;
  play_count: number;
  favorite_count: number;
  comment_count: number;
  listener_count: number;
  repost_count: number;
}

export default async function SchedulePage() {
  // Get the schedule data with error handling
  let scheduleItems: ScheduleShow[] = [];
  let isActive = false;
  try {
    const scheduleResponse = await getSchedule();
    scheduleItems = scheduleResponse?.object?.metadata?.shows || [];
    isActive = scheduleResponse?.object?.metadata?.is_active === "true";
  } catch (error) {
    console.error("Error fetching schedule:", error);
    // Continue with empty schedule items
  }

  // Sort shows by day of the week if we have any
  const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sortedItems = [...scheduleItems].sort((a, b) => {
    const dayA = daysOrder.indexOf(a.show_day);
    const dayB = daysOrder.indexOf(b.show_day);
    return dayA - dayB;
  });

  return (
    <div className="min-h-screen">
      <div className="mx-auto pb-32">
        <PageHeader title="Weekly Schedule" description={isActive ? "Tune in to our shows throughout the week." : "Our schedule is currently being updated."} breadcrumbs={[{ href: "/", label: "Home" }, { label: "Schedule" }]} />

        {/* Schedule list */}
        <div className="bg-background rounded-none shadow-sm overflow-hidden">
          {isActive && sortedItems.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedItems.map((show, index) => {
                // Extract show key segments for the link
                const segments = show.show_key.split("/").filter(Boolean);
                const showPath = segments.join("/");

                return (
                  <Link href={`/shows/${showPath}`} key={index} className="flex items-center gap-4 p-4 hover:bg-bronze-50 dark:hover:bg-bronze-900 transition-colors group">
                    {/* Show thumbnail */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-none overflow-hidden relative">
                      <Image src={show.picture || "/image-placeholder.svg"} alt={show.name} fill className="object-cover" />
                    </div>

                    {/* Show info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{show.show_day}</span>
                        <span className="text-sm text-foreground">•</span>
                        <span className="text-sm font-medium text-foreground">{show.show_time}</span>
                      </div>
                      <h3 className="text-lg leading-tight text-foreground group-hover:text-foreground transition-colors">{show.name}</h3>
                      {show.hosts.length > 0 && <p className="text-sm text-foreground mt-1 line-clamp-1">Hosted by: {show.hosts.join(", ")}</p>}
                      {show.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {show.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 uppercase">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="flex-shrink-0">
                      <ChevronRight className="h-5 w-5 text-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
              <h2 className="text-xl font-semibold text-foreground mb-2">No Current Schedule</h2>
              <p className="text-muted-foreground mb-8 max-w-lg">Our weekly schedule is currently being updated. In the meantime, you can browse our complete archive of shows.</p>
              <div className="flex gap-4">
                <Link href="/">
                  <Button variant="outline" className="text-crimson border-crimson hover:bg-crimson/10">
                    Back to Home
                  </Button>
                </Link>
                <Link href="/shows">
                  <Button className="bg-bronze-500 hover:bg-bronze-600 text-white">Browse All Shows</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
