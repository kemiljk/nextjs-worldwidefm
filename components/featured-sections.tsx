"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { useMediaPlayer } from "@/components/providers/media-player-provider";

interface FeaturedSectionsProps {
  showToDisplay: MixcloudShow | null;
  hasLiveShow: boolean;
  transformedUpcomingShows: any[];
}

export default function FeaturedSections({ showToDisplay, hasLiveShow, transformedUpcomingShows }: FeaturedSectionsProps) {
  const { playShow, currentShow, isPlaying, pauseShow } = useMediaPlayer();

  const handleShowClick = (show: MixcloudShow) => {
    const isCurrentShow = currentShow?.key === show.key;
    const isCurrentlyPlaying = isCurrentShow && isPlaying;

    if (isCurrentlyPlaying) {
      pauseShow();
    } else {
      playShow(show);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 relative z-10">
      {/* Left featured section */}
      <div className="flex flex-col h-full p-4 md:p-8 lg:p-10 border-b md:border-r border-black dark:border-white">
        <Card className="overflow-hidden shadow-none border-none relative cursor-pointer" onClick={() => showToDisplay && handleShowClick(showToDisplay)}>
          <CardContent className="p-0">
            <div className="relative aspect-square">
              <Image src={showToDisplay?.pictures.extra_large || "/image-placeholder.svg"} alt={showToDisplay?.name || "Show"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
              {/* Only show the ON AIR indicator for current live shows */}
              {hasLiveShow && (
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-white">ON AIR</span>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent">
              <div className="absolute bottom-4 left-4 right-4">
                {hasLiveShow && <div className="text-xs font-medium py-1 px-2 bg-black/80 text-white inline-block mb-2">ON NOW</div>}
                <h3 className="text-m5 font-mono font-normal text-white mt-1">{showToDisplay?.name || "No show available"}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right featured section */}
      <div className="h-full">
        <div className="flex flex-col h-full p-4 md:p-8 lg:p-10 border-b border-black dark:border-white">
          <Card className="overflow-hidden border-none shadow-none flex-grow cursor-pointer" onClick={() => transformedUpcomingShows[0] && handleShowClick(transformedUpcomingShows[0])}>
            <CardContent className="p-0 relative h-full flex flex-col">
              <div className="aspect-square w-full relative">
                <Image src={transformedUpcomingShows[0]?.image || "/image-placeholder.svg"} alt={transformedUpcomingShows[0]?.title || "Featured Show"} fill className="object-cover" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent">
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-m5 font-mono font-normal text-white mt-1">{transformedUpcomingShows[0]?.title || "No show available"}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
