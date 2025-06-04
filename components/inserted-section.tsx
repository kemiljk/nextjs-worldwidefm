import React from "react";
import { ProcessedHomepageSection, HomepageSectionItem, CosmicItem } from "@/lib/cosmic-types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

// Reusable Item Card (similar to the one in HomepageHero, could be centralized)
const SectionItemCard: React.FC<{ item: CosmicItem }> = ({ item }) => {
  const href = item.type === "radio-shows" ? `/shows/${item.slug}` : item.type === "posts" ? `/editorial/${item.slug}` : "#";
  // Fallback image if not provided
  const imageUrl = item.metadata.image?.url || item.metadata.featured_image?.imgix_url || "/image-placeholder.svg";

  return (
    <Card className="overflow-hidden border border-black dark:border-white h-full flex flex-col">
      <Link href={href} className="flex flex-col h-full group">
        <CardContent className="p-0 flex-grow">
          <div className="relative aspect-video w-full">
            <Image src={imageUrl} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
          </div>
          <div className="p-4 bg-card">
            <h3 className="text-lg font-semibold group-hover:underline">{item.title}</h3>
            {item.metadata.subtitle && <p className="text-sm text-muted-foreground line-clamp-2">{item.metadata.subtitle}</p>}
            {/* Add more metadata display based on item.type if needed */}
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
    <section className="py-8 md:py-12 lg:py-16 px-4 md:px-8 lg:px-16">
      <h2 className="text-2xl md:text-3xl font-bold font-display mb-6 md:mb-8">{section.title}</h2>
      {renderItems()}
    </section>
  );
};

export default CosmicSectionComponent;
