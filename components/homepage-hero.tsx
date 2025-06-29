import React from "react";
import { HomepageHeroItem, CosmicItem } from "@/lib/cosmic-types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface HomepageHeroProps {
  heroLayout: string;
  heroItems: HomepageHeroItem[];
}

const renderHeroItem = (item: CosmicItem, isPriority: boolean) => {
  // Basic card structure - can be expanded based on item.type and metadata
  // For example, if item.type is 'radio-shows', we might want to show play buttons, genres, etc.
  // If item.type is 'posts', we might show an excerpt or author.

  const href = item.type === "radio-shows" ? `/shows/${item.slug}` : item.type === "posts" ? `/editorial/${item.slug}` : "#";

  return (
    <Card key={item.slug} className="overflow-hidden shadow-none border-none relative cursor-pointer h-full flex flex-col">
      <Link href={href} className="flex flex-col h-full">
        <CardContent className="p-0 flex-grow">
          <div className="relative aspect-video w-full h-full max-h-[80dvh]">
            {item.metadata.image?.url && <Image src={item.metadata.image.url} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority={isPriority} />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-h8 font-display font-normal text-white">{item.title}</h3>
                {item.metadata.subtitle && <p className="text-sm text-gray-200 mt-2 line-clamp-2">{item.metadata.subtitle}</p>}
                {item.metadata.description && <p className="text-xs md:text-sm text-white max-w-xl mt-2 line-clamp-3">{item.metadata.description}</p>}
              </div>
            </div>
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
        <div className="flex flex-col h-full p-4 md:p-8 lg:p-10 border-b md:border-b-0 md:border-r border-black dark:border-white">{item1 && renderHeroItem(item1, true)}</div>
        <div className="h-full">
          <div className="flex flex-col h-full p-4 md:p-8 lg:p-10">{item2 && renderHeroItem(item2, false)}</div>
        </div>
      </div>
    );
  } else if (heroLayout === "Full Width") {
    const item1 = heroItems[0];
    if (!item1) return null;
    return <div className="relative z-10 p-4 md:p-8 lg:p-10 border-b border-black dark:border-white">{renderHeroItem(item1, true)}</div>;
  }
  // TODO: Implement other layouts like 'Carousel'
  // For Carousel, you might use a library like Embla Carousel or similar.

  console.warn(`HomepageHero: Encountered an unexpected or not-yet-implemented heroLayout: "${heroLayout}"`);
  return (
    <div className="p-4 md:p-8 lg:p-10 border-b border-black dark:border-white">
      <h2 className="text-h7 font-display font-normal text-almostblack mb-2">Hero Section (Layout: {heroLayout})</h2>
      <p className="text-red-500 font-semibold">Warning: Layout '{heroLayout}' is not recognized or fully implemented for the Hero section.</p>
    </div>
  );
};

export default HomepageHero;
