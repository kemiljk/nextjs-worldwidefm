"use client";

import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { cn } from "@/lib/utils";

interface PlayButtonProps {
  show: MixcloudShow;
  variant?: "default" | "secondary" | "outline-solid" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function PlayButton({ show, variant = "default", size = "default", className }: PlayButtonProps) {
  const { selectedMixcloudUrl, selectedShow, playShow, pauseShow, isArchivePlaying } = useMediaPlayer();

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isArchivePlaying;

  const handleClick = () => {
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

  return (
    <Button variant={variant} size={size} onClick={handleClick} className={cn(className)} aria-label={isCurrentlyPlaying ? `Pause ${show.name}` : `Play ${show.name}`}>
      {isCurrentlyPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      {size !== "icon" && <span className="ml-2">{isCurrentlyPlaying ? "Pause" : "Play"}</span>}
    </Button>
  );
}
