import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { MixcloudShow, filterWorldwideFMTags } from "@/lib/mixcloud-service";
import { PlayButton } from "@/components/play-button";

interface ShowsGridProps {
  shows: MixcloudShow[];
}

export function ShowsGrid({ shows }: ShowsGridProps) {
  if (shows.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-foreground">No shows found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {shows.map((show) => {
        // Convert key to path segments
        const segments = show.key.split("/").filter(Boolean);
        const showPath = segments.join("/");

        return (
          <article key={show.key} className="bg-transparent rounded-none overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
            <Link href={`/shows/${showPath}`}>
              <div className="aspect-video relative group">
                <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayButton show={show} />
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  {filterWorldwideFMTags(show.tags).map((tag) => (
                    <span key={tag.key} className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                      {tag.name}
                    </span>
                  ))}
                </div>
                <h3 className="font-medium line-clamp-1">{show.name}</h3>
                <div className="mt-2 space-y-1">
                  {show.hosts.length > 0 && <p className="text-sm text-foreground line-clamp-1">Hosted by: {show.hosts.map((host) => host.name).join(", ")}</p>}
                  <p className="text-xs text-foreground">{new Date(show.created_time).toLocaleDateString()}</p>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-foreground text-sm font-medium">View Details</span>
                  <div className="flex items-center gap-2">
                    <PlayButton show={show} variant="ghost" size="icon" className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
