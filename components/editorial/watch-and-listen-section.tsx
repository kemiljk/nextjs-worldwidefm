import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WatchAndListenObject } from "@/lib/cosmic-config";

interface WatchAndListenSectionProps {
  title: string;
  albumOfTheWeek: WatchAndListenObject | null;
  events: WatchAndListenObject | null;
  video: WatchAndListenObject | null;
}

export default function WatchAndListenSection({ title, albumOfTheWeek, events, video }: WatchAndListenSectionProps) {
  const items = [
    { title: "Album of the Week", item: albumOfTheWeek, slug: "album-of-the-week" },
    { title: "Events", item: events, slug: "events" },
    { title: "Video", item: video, slug: "video" },
  ].filter(({ item }) => item !== null);

  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-6">{title}</h3>
      <div className="grid grid-cols-2 gap-6">
        {/* Album of the Week */}
        {albumOfTheWeek && (
          <Link href="/watch-and-listen/album-of-the-week">
            <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-200 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100/50 dark:hover:bg-sky-950/30">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="relative aspect-square w-full">
                  <Image src={albumOfTheWeek.metadata?.image?.imgix_url || "/placeholder.svg"} alt={albumOfTheWeek.title || "Album of the Week"} fill className="object-cover" />
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <div>
                    <span className="text-sm text-sky-600 dark:text-sky-400">Album of the Week</span>
                    <h4 className="text-xl font-medium mb-3 text-gray-900 dark:text-gray-50 line-clamp-2">{albumOfTheWeek.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">{albumOfTheWeek.metadata?.description}</p>
                  <div className="mt-auto text-sky-600 dark:text-sky-400 font-medium text-sm flex items-center">
                    View More <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Events */}
        {events && (
          <Link href="/watch-and-listen/events">
            <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-200 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100/50 dark:hover:bg-sky-950/30">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="relative aspect-square w-full">
                  <Image src={events.metadata?.image?.imgix_url || "/placeholder.svg"} alt={events.title || "Events"} fill className="object-cover" />
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <div>
                    <span className="text-sm text-sky-600 dark:text-sky-400">Events</span>
                    <h4 className="text-xl font-medium mb-3 text-gray-900 dark:text-gray-50 line-clamp-2">{events.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">{events.metadata?.description}</p>
                  <div className="mt-auto text-sky-600 dark:text-sky-400 font-medium text-sm flex items-center">
                    View More <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Video - Full width */}
        {video && (
          <Link href="/watch-and-listen/video" className="col-span-2">
            <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-200 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100/50 dark:hover:bg-sky-950/30">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="relative aspect-video w-full">
                  <Image src={video.metadata?.image?.imgix_url || "/placeholder.svg"} alt={video.title || "Video"} fill className="object-cover" />
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <div>
                    <span className="text-sm text-sky-600 dark:text-sky-400">Video</span>
                    <h4 className="text-xl font-medium mb-3 text-gray-900 dark:text-gray-50 line-clamp-2">{video.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">{video.metadata?.description}</p>
                  <div className="mt-auto text-sky-600 dark:text-sky-400 font-medium text-sm flex items-center">
                    View More <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
