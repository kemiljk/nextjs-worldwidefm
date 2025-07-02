import type { SearchItem } from "@/lib/search/types";
import { ShowCard } from "./ui/show-card";

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
        const uniqueKey = `${show.id}-${show.slug}`;
        return <ShowCard key={uniqueKey} show={show} layout="grid" enableNavigation={true} imageAspect="square" showTimeLocation={false} />;
      })}
      {/* Infinite scroll sentinel at the end of the grid */}
      <div ref={sentinelRef} className="h-4 col-span-full" />
    </div>
  );
}
