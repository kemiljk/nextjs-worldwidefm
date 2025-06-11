import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { getEvents, transformRadioCultEvent } from "@/lib/radiocult-service";

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

/**
 * Fetch data from RadioCult and transform it into a weekly schedule
 */
async function getWeeklySchedule(): Promise<{ scheduleItems: ScheduleShow[]; isActive: boolean; error?: string }> {
  try {
    // Get all events from RadioCult for the next 7 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    // Because we're using date ranges, we need to use the schedule endpoint
    const { events = [] } = await getEvents({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 100, // High limit to ensure we get all events
    });

    console.log(`Retrieved ${events?.length || 0} events from RadioCult`);

    // Check if events is valid and not empty
    if (!events || events.length === 0) {
      console.log("No events returned from RadioCult");
      return {
        scheduleItems: [],
        isActive: false,
        error: "No schedule available at this time",
      };
    }

    // Transform RadioCult events to schedule items
    const scheduleItems = events.map((event) => {
      const eventDate = new Date(event.startTime);
      const hours = eventDate.getHours().toString().padStart(2, "0");
      const minutes = eventDate.getMinutes().toString().padStart(2, "0");

      // Get day name
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = days[eventDate.getDay()];

      return {
        show_key: event.slug,
        show_time: `${hours}:${minutes}`,
        show_day: dayName,
        name: event.showName,
        url: `/shows/${event.slug}`,
        picture: event.imageUrl || "/image-placeholder.svg",
        created_time: event.createdAt,
        tags: event.tags || [],
        hosts: (event.artists || []).map((artist) => artist.name || "Unknown Artist"),
        duration: event.duration || 0,
        play_count: 0,
        favorite_count: 0,
        comment_count: 0,
        listener_count: 0,
        repost_count: 0,
      };
    });

    return {
      scheduleItems,
      isActive: scheduleItems.length > 0,
    };
  } catch (error) {
    console.error("Error fetching RadioCult schedule:", error);
    return {
      scheduleItems: [],
      isActive: false,
      error: error instanceof Error ? error.message : "An error occurred while fetching the schedule",
    };
  }
}

export default async function SchedulePage() {
  // Get the schedule data from RadioCult
  const { scheduleItems, isActive, error } = await getWeeklySchedule();

  // Group shows by day
  const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const showsByDay = scheduleItems.reduce(
    (acc, show) => {
      if (!acc[show.show_day]) {
        acc[show.show_day] = [];
      }
      acc[show.show_day].push(show);
      return acc;
    },
    {} as Record<string, ScheduleShow[]>
  );

  // Sort shows within each day by time
  Object.keys(showsByDay).forEach((day) => {
    showsByDay[day].sort((a, b) => {
      const timeA = a.show_time.split(":").map(Number);
      const timeB = b.show_time.split(":").map(Number);
      return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
    });
  });

  return (
    <div className="min-h-screen">
      <div className="mx-auto pb-32">
        <PageHeader title="Weekly Schedule" description={error ? "We're experiencing issues loading the schedule. Please check back later." : isActive ? "Tune in to our shows throughout the week." : "Our schedule is currently being updated."} breadcrumbs={[{ href: "/", label: "Home" }, { label: "Schedule" }]} />

        {/* Schedule list */}
        <div className="overflow-hidden">
          {isActive && scheduleItems.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {daysOrder.map((day) => {
                const dayShows = showsByDay[day] || [];
                if (dayShows.length === 0) return null;

                return (
                  <div key={day} className="py-4">
                    <h2 className="text-xl font-bold mb-4">{day}</h2>
                    <div className="space-y-4">
                      {dayShows.map((show) => (
                        <Link href={`/shows/${show.show_key}`} key={`${show.show_day}-${show.show_time}-${show.name}`} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group">
                          {/* Show thumbnail */}
                          <div className="w-16 h-16 flex-shrink-0 rounded-none overflow-hidden relative">
                            <Image src={show.picture || "/image-placeholder.svg"} alt={show.name} fill className="object-cover" />
                          </div>

                          {/* Show info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-foreground">{show.show_time}</span>
                            </div>
                            <h3 className="text-lg leading-tight text-foreground group-hover:text-foreground transition-colors">{show.name}</h3>
                            {show.hosts.length > 0 && (
                              <p className="text-sm text-foreground mt-1 line-clamp-1">
                                Hosted by:{" "}
                                {show.hosts.map((hostName, index) => (
                                  <span key={hostName}>
                                    <Link href={`/hosts/${hostName.toLowerCase().replace(/\s+/g, "-")}`} className="hover:underline transition-colors">
                                      {hostName}
                                    </Link>
                                    {index < show.hosts.length - 1 && ", "}
                                  </span>
                                ))}
                              </p>
                            )}
                          </div>

                          {/* Action button */}
                          <div className="flex-shrink-0">
                            <ChevronRight className="h-5 w-5 text-foreground group-hover:text-foreground transition-colors" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
              <h2 className="text-xl font-semibold text-foreground mb-2">{error ? "Schedule Temporarily Unavailable" : "No Current Schedule"}</h2>
              <p className="text-muted-foreground mb-8 max-w-lg">{error ? "We're having trouble connecting to our schedule service. Please check back later while we resolve this issue." : "Our weekly schedule is currently being updated. In the meantime, you can browse our complete archive of shows."}</p>
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
