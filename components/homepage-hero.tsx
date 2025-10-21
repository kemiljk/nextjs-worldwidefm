import React from "react";
import { HomepageHeroItem, CosmicItem } from "@/lib/cosmic-types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils";
import { GenreObject } from "@/lib/cosmic-config";
import { PlayButton } from "@/components/play-button";
import { HighlightedText } from "@/components/ui/highlighted-text";

interface HomepageHeroProps {
  heroLayout: string;
  heroItems: HomepageHeroItem[];
}

const renderHeroItem = (item: CosmicItem, isPriority: boolean) => {
  // Basic card structure - can be expanded based on item.type and metadata
  // For example, if item.type is 'episodes', we might want to show play buttons, genres, etc.
  // If item.type is 'posts', we might show an excerpt or author.

  const href = item.type === "episodes" ? `/episode${item.slug}` : item.type === "posts" ? `/editorial/${item.slug}` : "#";

  return (
    <Card key={item.slug} className="overflow-hidden shadow-none rounded-none relative cursor-pointer h-full flex flex-col">
      <Link href={href} className="flex flex-col h-full">
        <CardContent className="p-0 grow flex flex-col">
          <div className="relative w-full h-[calc(100dvh-112px)] flex items-center justify-center">
            <Image
              src={item.metadata.image?.imgix_url || item.metadata.image?.url || "/image-placeholder.png"}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority={isPriority}
              onError={(e: any) => {
                if (e?.currentTarget) {
                  try {
                    e.currentTarget.src = "/image-placeholder.png";
                  } catch {}
                }
              }}
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex bg-linear-to-t from-almostblack to-transparent h-1/2 flex-col p-4 flex-1 justify-end">
            <div className="bg-almostblack uppercase text-white w-fit text-h8 leading-none font-display pt-1 px-1 text-left">{(item.metadata.date && formatDateShort(item.metadata.date)) || formatDateShort(item.metadata.broadcast_date)}</div>
            <h3 className="text-h7 max-w-2xl leading-none font-display w-fit">
              <HighlightedText variant="white">{item.title}</HighlightedText>
            </h3>
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

// New: EpisodeHero for episode pages
export const EpisodeHero = ({ displayName, displayImage, showDate, show }: { displayName: string; displayImage: string; showDate: string; show: any }) => {
  if (!displayImage || !displayName) return null;

  // Since we now filter episodes at fetch level, all episodes have audio content
  // For other content, check if there's actual audio content
  const isEpisode = show?.__source === "episode" || show?.episodeData || show?.type === "episode";
  const hasAudioContent = show?.url || show?.player || show?.metadata?.player;

  return (
    <div className="relative w-full h-[calc(100dvh-80px)] aspect-[2/1]">
      {/* Overlay: soft blur + blend */}
      <div className="absolute inset-0 w-full h-full z-10 bg-blend-multiply bg-white/10 backdrop-blur-[20px] pointer-events-none" />

      <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: "200px 200px",
            mixBlendMode: "screen",
          }}
        />
      </div>
      <Image src={displayImage} alt={displayName} fill priority className="object-cover object-center w-full h-full select-none pointer-events-none" sizes="100vw" />
      {/* Overlay: Play Button and Text - Always show artwork and title */}
      <div className="absolute inset-0 flex justify-center items-center z-30">
        <div className="flex flex-col lg:flex-row gap-10 px-4 items-start lg:items-center max-w-[90%] w-full">
          <div className="relative w-full max-w-[500px] lg:max-w-[600px] aspect-square border border-almostblack z-30">
            <Image src={displayImage} alt={displayName} fill priority className="object-cover object-center w-full h-full select-none pointer-events-none" sizes="100vw" />
            {/* Only show play button if there's audio content */}
            {(isEpisode || hasAudioContent) && show?.metadata?.player && <PlayButton show={show} variant="default" className="absolute bottom-0 right-0 m-5 rounded-full shadow-xl h-13 aspect-square flex items-center justify-center text-white bg-almostblack/90 hover:bg-almostblack" label={false} />}
          </div>
          <div className="flex flex-col max-w-full pb-2 lg:flex-1">
            {showDate && <span className="inline-block bg-almostblack text-white font-display text-h8 leading-none uppercase w-fit px-1 text-left shadow-lg border border-almostblack">{showDate}</span>}
            <span className="text-h7 max-w-2xl leading-none font-display w-fit uppercase font-bold ">
              <HighlightedText variant="white">{displayName}</HighlightedText>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomepageHero;
