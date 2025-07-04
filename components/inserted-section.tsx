import React from "react";
import { ProcessedHomepageSection, CosmicItem } from "@/lib/cosmic-types";
import { ShowCard } from "@/components/ui/show-card";

// Reusable Item Card (similar to the one in HomepageHero, could be centralized)
const SectionItemCard: React.FC<{ item: CosmicItem }> = ({ item }) => {
  if (item.type === "radio-shows") {
    // Adapt CosmicItem to MixcloudShow shape for ShowCard
    const show = {
      key: item.slug,
      name: item.title,
      url: `/shows/${item.slug}`,
      slug: item.slug,
      pictures: {
        large: item.metadata.image?.url || item.metadata.featured_image?.imgix_url || "/image-placeholder.svg",
      },
      user: {
        name: item.metadata.label || item.metadata.author || "",
        username: item.metadata.label || item.metadata.author || "",
      },
      created_time: item.metadata.created_time || item.metadata.date || "",
      tags: item.metadata.tags || item.metadata.categories || [],
      // Add any other fields ShowCard expects as needed
    };
    return <ShowCard show={show} slug={show.url} />;
  }
  // Use ShowCard (non-playable) for posts and other types
  const show = {
    key: item.slug,
    name: item.title,
    url: item.type === "posts" ? `/editorial/${item.slug}` : `/${item.type}/${item.slug}`,
    slug: item.slug,
    pictures: {
      large: item.metadata.image?.url || item.metadata.featured_image?.imgix_url || "/image-placeholder.svg",
    },
    user: {
      name: item.metadata.author?.title || item.metadata.author || "",
      username: item.metadata.author?.title || item.metadata.author || "",
    },
    created_time: item.metadata.date || item.metadata.created_time || "",
    tags: (item.metadata.categories || item.metadata.tags || [])
      .map((cat: any) => {
        if (typeof cat === "string") return cat;
        if (cat && typeof cat === "object" && "title" in cat && typeof cat.title === "string") return cat.title;
        return "";
      })
      .filter((tag: string) => !!tag),
    excerpt: item.metadata.excerpt || "",
  };
  return <ShowCard show={show} slug={show.url} playable={false} />;
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
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsClass} gap-4`}>
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
      <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white mb-6 md:mb-8">{section.title}</h2>
      {renderItems()}
    </section>
  );
};

export default CosmicSectionComponent;
