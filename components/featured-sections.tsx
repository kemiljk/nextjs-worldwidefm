"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import { formatDateShort } from "@/lib/utils";

interface FeaturedSectionsProps {
  showToDisplay: MixcloudShow | null;
  hasLiveShow: boolean;
  transformedUpcomingShows: any[];
}

export default function FeaturedSections({ showToDisplay, transformedUpcomingShows }: FeaturedSectionsProps) {
  const { selectedMixcloudUrl, setSelectedMixcloudUrl, selectedShow, setSelectedShow } = useMediaPlayer();

  const handleShowClick = (show: MixcloudShow) => {
    const isCurrentlyPlaying = selectedShow?.key === show.key;

    if (isCurrentlyPlaying) {
      setSelectedMixcloudUrl(null);
      setSelectedShow(null);
    } else {
      setSelectedMixcloudUrl(show.url);
      setSelectedShow({
        key: show.key,
        name: show.name,
        url: show.url,
        slug: show.slug,
        pictures: show.pictures,
        user: {
          name: show.user.name,
          username: show.user.username,
        },
        created_time: show.created_time,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 relative z-10">
      {/* Left featured section */}
      <div className="flex flex-col h-full p-5 pr-2.5">
        <Card className="overflow-hidden shadow-none relative cursor-pointer border border-almostblack dark:border-white" onClick={() => showToDisplay && handleShowClick(showToDisplay)}>
          <CardContent className="p-0">
            <div className="relative aspect-square">
              <Image src={showToDisplay?.pictures.extra_large || "/image-placeholder.svg"} alt={showToDisplay?.name || "Show"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
              <div className="absolute bottom-0 left-0 right-0 flex bg-gradient-to-t from-almostblack to-transparent h-1/2 flex-col p-4 flex-1 justify-end">
                {showToDisplay && (
                  <>
                    <div className="bg-almostblack uppercase text-white w-fit text-h8 leading-none font-display pt-2 p-1 text-left">{formatDateShort(showToDisplay.updated_time)}</div>
                    <h3 className="bg-white border border-almostblack text-h8 max-w-2xl leading-none font-display text-almostblack pt-2 p-1 text-left w-fit">{showToDisplay.name}</h3>
                    {/* {showToDisplay.updated_time && <p className="text-m5 font-mono text-white max-w-xl mt-2 line-clamp-3 text-left">{showToDisplay.updated_time}</p>} */}
                    {showToDisplay.tags && (
                      <div className="flex showToDisplays-center">
                        {showToDisplay.tags
                          .filter((tag: { key: string; url: string; name: string }) => tag.name.toLocaleLowerCase() != "worldwide fm")
                          .map((tag: { key: string; url: string; name: string }) => (
                            <p key={tag.key} className="text-m7 font-mono uppercase text-white border border-white rounded-full px-2 py-1 max-w-xl mt-2 line-clamp-3 text-left">
                              {tag.name}
                            </p>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right featured section */}
      <div className="h-full">
        <div className="flex flex-col h-full p-5 pl-2.5">
          <Card className="overflow-hidden shadow-none flex-grow cursor-pointer border border-almostblack dark:border-white" onClick={() => transformedUpcomingShows[0] && handleShowClick(transformedUpcomingShows[0])}>
            <CardContent className="p-0 relative h-full flex flex-col">
              <div className="aspect-square w-full relative">
                <Image src={transformedUpcomingShows[0]?.image || "/image-placeholder.svg"} alt={transformedUpcomingShows[0]?.title || "Featured Show"} fill className="object-cover" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex bg-gradient-to-t from-almostblack to-transparent h-1/2 flex-col p-4 flex-1 justify-end">
                {transformedUpcomingShows[0] && (
                  <>
                    <div className="bg-almostblack uppercase text-white w-fit text-h8 leading-none font-display pt-2 p-1 text-left">{formatDateShort(transformedUpcomingShows[0].updated_time)}</div>
                    <h3 className="bg-white border border-almostblack text-h8 max-w-2xl leading-none font-display text-almostblack pt-2 p-1 text-left w-fit">{transformedUpcomingShows[0].name}</h3>
                    {/* {showToDisplay.updated_time && <p className="text-m5 font-mono text-white max-w-xl mt-2 line-clamp-3 text-left">{showToDisplay.updated_time}</p>} */}
                    {transformedUpcomingShows[0].tags && (
                      <div className="flex showToDisplays-center">
                        {transformedUpcomingShows[0].tags
                          .filter((tag: { key: string; url: string; name: string }) => tag.name.toLocaleLowerCase() != "worldwide fm")
                          .map((tag: { key: string; url: string; name: string }) => (
                            <p key={tag.key} className="text-m7 font-mono uppercase text-white border border-white rounded-full px-2 py-1 max-w-xl mt-2 line-clamp-3 text-left">
                              {tag.name}
                            </p>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
