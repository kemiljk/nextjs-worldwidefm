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
        <p className="text-foreground">Fetching shows...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
      {shows.map((show) => {
        // Convert key to path segments
        const segments = show.key.split("/").filter(Boolean);
        const showPath = segments.join("/");

        return (
          <article key={show.key} className="bg-transparent rounded-none overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
            <Link href={`/shows/${showPath}`}>
              <div className="aspect-square relative group">
                <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayButton show={show} />
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-foreground mb-1">{new Date(show.created_time).toLocaleDateString()}</p>
                <h3 className="font-medium line-clamp-2">{show.name}</h3>
                <div className="flex flex-wrap gap-2 mt-4">
                  {filterWorldwideFMTags(show.tags)
                    .slice(0, 3)
                    .map((tag) => (
                      <span key={tag.key} className="text-[9.5px] px-2 py-1 rounded-full border border-foreground uppercase">
                        {tag.name}
                      </span>
                    ))}
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
