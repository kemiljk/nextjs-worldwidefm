// Removed MixcloudShow import - using any type for show format compatibility
import { ShowCard } from "./ui/show-card";

interface ShowsGridProps {
  shows: any[]; // Using any for show format compatibility
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {shows.filter(Boolean).map((show: any, index: number) => {
        const uniqueKey = `${show.id || show.slug}-${index}`;
        return <ShowCard key={uniqueKey} show={show} slug={`/episode/${show.slug}`} />;
      })}
      {/* Infinite scroll sentinel at the end of the grid */}
      <div ref={sentinelRef} className="h-4 col-span-full" />
    </div>
  );
}
