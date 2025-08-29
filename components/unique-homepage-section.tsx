"use client";

import React from "react";
import { ShowCard } from "@/components/ui/show-card";
import { ProcessedHomepageSection, CosmicItem, ColouredSection } from "@/lib/cosmic-types";

interface UniqueHomepageSectionProps {
  section: ProcessedHomepageSection;
  colouredSection?: ColouredSection; // Optional coloured section data
}

const UniqueHomepageSection: React.FC<UniqueHomepageSectionProps> = ({ section, colouredSection }) => {
  if (!section.is_active || !section.items || section.items.length === 0) {
    return null;
  }

  // Colors are now assigned sequentially in the parent component
  // Fallback to orange if no color is provided
  const sectionColor = section.color || "#F8971D";

  // Convert Cosmic items to show format for ShowCard
  const convertToShowFormat = (item: CosmicItem) => {
    if (item.type === "regular-hosts") {
      return {
        key: item.slug,
        name: item.title,
        url: `/hosts/${item.slug}`,
        slug: item.slug,
        pictures: {
          large: item.metadata.image?.url || item.metadata.image?.imgix_url || "/image-placeholder.svg",
        },
        user: {
          name: item.title,
          username: item.slug,
        },
        created_time: item.metadata.created_time || item.metadata.date || "",
        tags: item.metadata.tags || item.metadata.categories || [],
        description: item.metadata.description || "",
      };
    }

    // Handle other item types (episodes, posts, etc.)
    return {
      key: item.slug,
      name: item.title,
      url: item.type === "posts" ? `/editorial/${item.slug}` : item.type === "episodes" ? `/episode/${item.slug}` : `/${item.type}/${item.slug}`,
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
  };

  const shows = section.items.map(convertToShowFormat);

  // Use coloured section data if available, otherwise fall back to section data
  const displayTitle = colouredSection?.title || section.title;
  const displayTime = colouredSection?.time || section.subtitle || "";
  const displayDescription = colouredSection?.description || section.description || "";

  return (
    <section className="relative w-full overflow-hidden">
      {/* Gradient Background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${sectionColor}20 0%, ${sectionColor} 13%, ${sectionColor} 93%, ${sectionColor}20 100%)`,
        }}
      />

      {/* Noise Overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          mixBlendMode: "overlay",
        }}
      />

      {/* Content Container */}
      <div className="relative z-10 px-5 py-24">
        {/* Section Header */}
        <div className="flex items-center pb-12">
          {/* Main Title */}
          <div className="bg-almostblack">
            <div className="px-2 pt-0.5">
              <h2 className="font-display text-4xl md:text-5xl leading-none text-white uppercase tracking-tight">{displayTitle}</h2>
            </div>
          </div>

          {/* Subtitle with color background */}
          {displayTime && (
            <div style={{ backgroundColor: sectionColor }}>
              <div className="px-2 pt-0.5">
                <h3 className="font-display text-4xl md:text-5xl leading-none text-almostblack uppercase tracking-tight">{displayTime}</h3>
              </div>
            </div>
          )}

          {/* Description */}
          {displayDescription && (
            <div className="max-w-2xl ml-12">
              <p className="font-body text-xl text-almostblack leading-none">{displayDescription}</p>
            </div>
          )}
        </div>

        {/* Shows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {shows.map((show, index) => (
            <div key={show.key || index} className="flex">
              <ShowCard show={show} slug={show.url} playable className="w-full" />
            </div>
          ))}
        </div>

        {/* See All Link */}
        <div className="text-center mt-12">
          <a href={`/${section.type}`} className="font-mono text-xl text-almostblack uppercase underline hover:no-underline transition-all">
            SEE ALL &gt;
          </a>
        </div>
      </div>
    </section>
  );
};

export default UniqueHomepageSection;
