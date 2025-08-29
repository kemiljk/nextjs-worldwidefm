"use client";

import { Play, Pause } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMediaPlayer } from "../providers/media-player-provider";
import { GenreTag } from "./genre-tag";

interface ShowCardProps {
  show: any; // Using any to work with both episode and legacy show formats
  slug: string;
  className?: string;
  playable?: boolean;
}

export const ShowCard: React.FC<ShowCardProps> = ({ show, slug, className = "", playable = true }) => {
  // Since we now filter episodes at fetch level, all episodes have audio content
  // For other content, check if there's actual audio content
  const isEpisode = show?.__source === "episode" || show?.episodeData || show?.type === "episode";
  const hasAudioContent = show?.url || show?.player || show?.metadata?.player;
  const shouldShowPlayButton = playable && (isEpisode || hasAudioContent);
  const { playShow, pauseShow, selectedShow, isArchivePlaying } = useMediaPlayer();

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isArchivePlaying;
  const handlePlayPause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // For episodes without player URL, try to play anyway (might have fallback logic)
    // For non-episodes, require audio content
    if (!isEpisode && !hasAudioContent) return;

    if (isCurrentShow) {
      if (isCurrentlyPlaying) {
        pauseShow();
      } else {
        playShow(show);
      }
    } else {
      playShow(show);
    }
  };

  const getShowImage = (show: any) => {
    return show.pictures?.large || show.pictures?.extra_large || show.enhanced_image || show.imageUrl || show.image || show.metadata?.image?.imgix_url || "/image-placeholder.svg";
  };

  const getShowTags = (show: any): string[] => {
    if (show.tags && Array.isArray(show.tags)) {
      return show.tags
        .filter((tag: any) => tag.name?.toLowerCase() !== "worldwide fm")
        .slice(0, 3)
        .map((tag: any) => tag.name || tag.title || tag);
    }
    if (show.enhanced_genres && Array.isArray(show.enhanced_genres)) {
      return show.enhanced_genres.slice(0, 3);
    }
    if (show.metadata?.genres && Array.isArray(show.metadata.genres)) {
      return show.metadata.genres.slice(0, 3);
    }
    if (show.genres && Array.isArray(show.genres)) {
      return show.genres.slice(0, 3);
    }
    return [];
  };

  const formatShowTime = (dateString: string | undefined): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return (
      date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
        hour12: false,
      }) + " [BST]"
    );
  };

  const showImage = getShowImage(show);
  const showTags = getShowTags(show);
  const createdTime = show.created_time || show.created_at || show.broadcast_date || show.date;
  const showName = show.name || show.title || "Untitled Show";
  const showHost = show.user?.name || show.host || "";
  const formattedTime = formatShowTime(createdTime);

  // Split showName for two-line title (Figma: first line main, second line host/guest)
  const [mainTitle, ...restTitle] = showName.split(":");
  const subtitle = restTitle.length > 0 ? restTitle.join(":").trim() : showHost;

  return (
    <Link href={slug} className={`border border-almostblack dark:border-white rounded-none overflow-hidden flex flex-col p-4 h-full w-full max-w-[440px] ${className}`}>
      {/* Image */}
      <div className="relative w-full h-full">
        <div className="relative w-full aspect-square lg:h-[440px]">
          <Image src={showImage} alt={showName} fill className="object-cover border border-almostblack dark:border-white" sizes="320px" priority={false} />
        </div>
      </div>
      {/* Details */}
      <div className="flex flex-col justify-between h-full pt-4 pb-1 relative grow">
        {/* Title */}
        <div className="h-full flex-1 flex flex-col">
          <div className="font-mono text-2xl leading-none text-almostblack dark:text-white uppercase w-full break-none line-clamp-2">{mainTitle}</div>
          {subtitle && <div className="font-mono text-xl leading-none text-almostblack/75 dark:text-white/75 uppercase w-full break-words line-clamp-2">{subtitle}</div>}
        </div>
        {/* Show Info */}
        {(formattedTime || show.location?.name) && (
          <div className="flex flex-row items-center gap-2.5 font-mono text-xs text-almostblack dark:text-white uppercase pl-1 pt-1">
            {formattedTime && <span>{formattedTime}</span>}
            {formattedTime && show.location?.name && <span>|</span>}
            {show.location?.name && <span>{show.location?.name}</span>}
          </div>
        )}
        {/* Tags and Play Button */}
        <div className="flex flex-row items-end justify-between w-full mt-4">
          <div className="flex flex-row flex-wrap">
            {showTags.map((tag, idx) => (
              <GenreTag key={tag + idx}>{tag}</GenreTag>
            ))}
          </div>
          {shouldShowPlayButton && (
            <button className="bg-almostblack rounded-full w-10 h-10 flex items-center justify-center ml-2 transition-colors hover:bg-gray-800 border border-almostblack dark:border-white" style={{ minWidth: 40, minHeight: 40 }} onClick={handlePlayPause} aria-label={isCurrentlyPlaying ? "Pause show" : "Play show"}>
              {isCurrentlyPlaying ? <Pause fill="white" className="w-5 h-5 text-white" /> : <Play fill="white" className="w-5 h-5 text-white pl-0.5" />}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
};
