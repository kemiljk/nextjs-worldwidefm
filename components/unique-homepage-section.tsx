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

  const colors: { [key: string]: string } = {
    orange: "#F8971D",
    green: "#88CA4F",
    purple: "#9661FA",
    blue: "#1DA0F8",
  };

  // Get a random color for the section
  const getRandomColor = (): string => {
    const colorKeys = Object.keys(colors);
    const randomKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
    return colors[randomKey];
  };

  const sectionColor = section.color || getRandomColor();

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

    // Handle other item types (radio-shows, posts, etc.)
    return {
      key: item.slug,
      name: item.title,
      url: item.type === "posts" ? `/editorial/${item.slug}` : item.type === "radio-shows" ? `/episode/${item.slug}` : `/${item.type}/${item.slug}`,
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
          background: `linear-gradient(180deg, ${sectionColor}30 0%, ${sectionColor} 13%, ${sectionColor} 93%, ${sectionColor}30 100%)`,
        }}
      />

      {/* Content Container */}
      <div className="relative z-10 px-5 py-24">
        {/* Section Header */}
        <div className="flex items-center pb-12">
          {/* Main Title */}
          <div className="bg-almostblack">
            <div className="px-2 pt-1">
              <h2 className="font-display text-4xl md:text-5xl leading-none text-white uppercase tracking-tight">{displayTitle}</h2>
            </div>
          </div>

          {/* Subtitle with color background */}
          {displayTime && (
            <div style={{ backgroundColor: sectionColor }}>
              <div className="px-2 pt-1">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
