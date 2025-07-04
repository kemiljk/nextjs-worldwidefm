import React from "react";
import { HomepageHeroItem, CosmicItem } from "@/lib/cosmic-types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils";
import { GenreObject } from "@/lib/cosmic-config";

interface HomepageHeroProps {
  heroLayout: string;
  heroItems: HomepageHeroItem[];
}

const renderHeroItem = (item: CosmicItem, isPriority: boolean) => {
  // Basic card structure - can be expanded based on item.type and metadata
  // For example, if item.type is 'radio-shows', we might want to show play buttons, genres, etc.
  // If item.type is 'posts', we might show an excerpt or author.

  const href = item.type === "radio-shows" ? `/episode/${item.slug}` : item.type === "posts" ? `/editorial/${item.slug}` : "#";

  return (
    <Card key={item.slug} className="overflow-hidden shadow-none rounded-none relative cursor-pointer h-full flex flex-col">
      <Link href={href} className="flex flex-col h-full">
        <CardContent className="p-0 grow flex flex-col">
          <div className="relative w-full h-[calc(100dvh-112px)] flex items-center justify-center">{item.metadata.image?.url && <Image src={item.metadata.image.url} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority={isPriority} />}</div>
          <div className="absolute bottom-0 left-0 right-0 flex bg-linear-to-t from-almostblack to-transparent h-1/2 flex-col p-4 flex-1 justify-end">
            <div className="bg-almostblack uppercase text-white w-fit text-h8 leading-none font-display pt-2 p-1 text-left">{(item.metadata.date && formatDateShort(item.metadata.date)) || formatDateShort(item.metadata.broadcast_date)}</div>
            <h3 className="bg-white border border-almostblack text-h8 max-w-2xl leading-none font-display text-almostblack dark:text-white pt-2 p-1 text-left w-fit">{item.title}</h3>
            {item.metadata.broadcast_time && <p className="text-m5 font-mono text-white max-w-xl mt-2 line-clamp-3 text-left">{item.metadata.broadcast_time}</p>}
            {item.metadata.genres && (
              <div className="flex items-center">
                {item.metadata.genres.map((genre: GenreObject) => (
                  <p key={genre.id} className="text-m7 font-mono uppercase text-white border border-white rounded-full px-2 py-1 max-w-xl mt-2 line-clamp-3 text-left">
                    {genre.title}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
};

const HomepageHero: React.FC<HomepageHeroProps> = ({ heroLayout, heroItems }) => {
  if (!heroItems || heroItems.length === 0) {
    return null; // Fallback to FeaturedSections is handled in page.tsx
  }

  if (heroLayout === "Split") {
    const item1 = heroItems[0];
    const item2 = heroItems.length > 1 ? heroItems[1] : null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 relative z-10">
        <div className="flex flex-col h-full">{item1 && renderHeroItem(item1, true)}</div>
        <div className="h-full">
          <div className="flex flex-col h-full">{item2 && renderHeroItem(item2, false)}</div>
        </div>
      </div>
    );
  } else if (heroLayout === "Full Width") {
    const item1 = heroItems[0];
    if (!item1) return null;
    return <div className="relative z-10">{renderHeroItem(item1, true)}</div>;
  }
  // TODO: Implement other layouts like 'Carousel'
  // For Carousel, you might use a library like Embla Carousel or similar.

  console.warn(`HomepageHero: Encountered an unexpected or not-yet-implemented heroLayout: "${heroLayout}"`);
  return (
    <div>
      <h2 className="text-h7 font-display uppercase text-almostblack dark:text-white mb-2">Hero Section (Layout: {heroLayout})</h2>
      <p className="text-red-500 font-semibold">Warning: Layout '{heroLayout}' is not recognized or fully implemented for the Hero section.</p>
    </div>
  );
};

export default HomepageHero;
