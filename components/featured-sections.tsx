import { FeaturedCard } from "./featured-card";

interface FeaturedSectionsProps {
  shows: any[];
}

export default function FeaturedSections({ shows }: FeaturedSectionsProps) {
  if (!shows || shows.length === 0) return null;

  const featuredShows = shows.slice(0, 2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5 h-[90vh] min-h-150">
      {featuredShows.map((show, index) => (
        <FeaturedCard key={show.id || show.slug || index}   slug={`/episode${show.key ?? show.slug}`} show={show} priority={index === 0} />
      ))}
    </div>
  );
}