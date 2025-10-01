// Removed MixcloudShow import - using any type for show format compatibility
import { ShowCard } from "./ui/show-card";

interface ShowsGridProps {
  shows: any[]; // Using any for show format compatibility
  contentType?: "episodes" | "hosts-series" | "takeovers";
}

export function ShowsGrid({ shows, contentType = "episodes" }: ShowsGridProps) {
  if (shows.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="font-mono text-almostblack text-m8 uppercase">Fetching shows...</p>
      </div>
    );
  }

  const getSlugForShow = (show: any) => {
    // Use __source if available, otherwise fall back to contentType
    const source = show.__source || contentType;

    switch (source) {
      case "host":
        return `/hosts/${show.slug}`;
      case "takeover":
        return `/takeovers/${show.slug}`;
      case "episode":
      default:
        return `/episode/${show.slug}`;
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full h-auto">
      {shows.filter(Boolean).map((show: any, index: number) => {
        const uniqueKey = `${show.id || show.slug}-${index}`;
        const slug = getSlugForShow(show);
        return <ShowCard className="w-full" key={uniqueKey} show={show} slug={slug} />;
      })}
    </div>
  );
}
