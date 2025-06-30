import React from "react";
import { ProcessedHomepageSection, HomepageSectionItem, CosmicItem } from "@/lib/cosmic-types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

// Reusable Item Card (similar to the one in HomepageHero, could be centralized)
const SectionItemCard: React.FC<{ item: CosmicItem }> = ({ item }) => {
  const href = item.type === "radio-shows" ? `/episode/${item.slug}` : item.type === "posts" ? `/editorial/${item.slug}` : "#";
  const imageUrl = item.metadata.image?.url || item.metadata.featured_image?.imgix_url || "/image-placeholder.svg";
  const tags = item.metadata.tags || item.metadata.categories || [];
  const label = item.metadata.label || item.metadata.author || "";
  const location = item.metadata.location || item.metadata.origin || "";

  return (
    <Card className="overflow-hidden bg-white dark:bg-black h-full flex flex-col border border-black dark:border-white rounded-none shadow-none">
      <Link href={href} className="flex flex-col h-full group">
        <CardContent className="p-0 flex-grow flex flex-col">
          <div className="relative aspect-[1.1/1] w-full border-b border-black dark:border-white bg-gray-100 flex items-center justify-center">
            <Image src={imageUrl} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
          </div>
          <div className="flex flex-col gap-2 p-4 flex-1 justify-end">
            <h3 className="text-m4 font-mono font-normal text-almostblack mb-1 text-left">{item.title}</h3>
            {(label || location) && (
              <div className="text-m7 font-mono font-normal text-almostblack opacity-80 text-left">
                {label}
                {label && location && " | "}
                {location}
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag: any, idx: number) => (
                  <span key={idx} className="border border-black dark:border-white text-m8 font-mono px-2 py-1 rounded-none uppercase tracking-wide bg-transparent">
                    {typeof tag === "string" ? tag : tag.title || tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
};

interface CosmicSectionProps {
  section: ProcessedHomepageSection;
}

const CosmicSectionComponent: React.FC<CosmicSectionProps> = ({ section }) => {
  if (!section.is_active || !section.items || section.items.length === 0) {
    return null;
  }

  const renderItems = () => {
    if (section.layout === "Grid") {
      const gridColsClass = section.itemsPerRow === 4 ? "md:grid-cols-4" : section.itemsPerRow === 3 ? "md:grid-cols-3" : section.itemsPerRow === 2 ? "md:grid-cols-2" : "md:grid-cols-1";
      return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsClass} gap-4 md:gap-6 lg:gap-8`}>
          {section.items.map((item) => (
            <SectionItemCard key={item.slug} item={item} />
          ))}
        </div>
      );
    } else if (section.layout === "Carousel") {
      // Placeholder for Carousel layout
      // You might use a library like Embla Carousel here, similar to other carousels in your project.
      // For now, rendering as a list.
      return (
        <div className="flex overflow-x-auto space-x-4 pb-4">
          {section.items.map((item) => (
            <div key={item.slug} className="min-w-[280px] md:min-w-[320px]">
              <SectionItemCard item={item} />
            </div>
          ))}
        </div>
      );
    } else if (section.layout === "FullWidth") {
      return (
        <div className="space-y-4 md:space-y-6 lg:space-y-8">
          {section.items.map((item) => (
            <div key={item.slug}>
              <SectionItemCard item={item} />
            </div>
          ))}
        </div>
      );
    }
    // Default or other layouts can be added here
    return <p>Layout '{section.layout}' not implemented yet.</p>;
  };

  return (
    <section className="py-8 md:py-12 lg:py-16 px-5">
      <h2 className="text-h7 font-display uppercase font-normal text-almostblack mb-6 md:mb-8">{section.title}</h2>
      {renderItems()}
    </section>
  );
};

export default CosmicSectionComponent;
