import Image from "next/image";
import Link from "next/link";
import type { SearchItem } from "@/lib/search/types";

interface ShowsGridProps {
  shows: SearchItem[];
  sentinelRef?: React.Ref<HTMLDivElement>;
}

export function ShowsGrid({ shows, sentinelRef }: ShowsGridProps) {
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
        const showPath = show.slug;
        const uniqueKey = `${show.id}-${show.slug}`;
        return (
          <article key={uniqueKey} className="bg-transparent rounded-none overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
            <Link href={`/${show.contentType}/${showPath}`}>
              <div className="aspect-square relative group">
                <Image src={show.image || "/image-placeholder.svg"} alt={show.title} fill className="object-cover" />
                {/* Optionally add PlayButton if audio is available */}
                {/* <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayButton show={show} />
                </div> */}
              </div>
              <div className="p-4">
                {show.date && <p className="text-xs text-foreground mb-1">{new Date(show.date).toLocaleDateString()}</p>}
                <h3 className="text-m7 font-mono font-normal text-almostblack line-clamp-2">{show.title}</h3>
                <div className="flex flex-wrap gap-2 mt-4">
                  {show.genres?.slice(0, 3).map((genre) => (
                    <span key={genre.slug} className="text-[9.5px] px-2 py-1 rounded-full border border-foreground uppercase">
                      {genre.title}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </article>
        );
      })}
      {/* Infinite scroll sentinel at the end of the grid */}
      <div ref={sentinelRef} className="h-4 col-span-full" />
    </div>
  );
}
