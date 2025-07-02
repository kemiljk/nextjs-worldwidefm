"use client";

import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { cn } from "@/lib/utils";

interface PlayButtonProps {
  show: MixcloudShow;
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function PlayButton({ show, variant = "default", size = "default", className }: PlayButtonProps) {
  const { selectedMixcloudUrl, setSelectedMixcloudUrl, selectedShow, setSelectedShow } = useMediaPlayer();

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && selectedMixcloudUrl;

  const handleClick = () => {
    if (isCurrentlyPlaying) {
      // Stop current playback
      setSelectedMixcloudUrl(null);
      setSelectedShow(null);
    } else {
      // Start playing this show
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
    <Button variant={variant} size={size} onClick={handleClick} className={cn(className)} aria-label={isCurrentlyPlaying ? `Pause ${show.name}` : `Play ${show.name}`}>
      {isCurrentlyPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      {size !== "icon" && <span className="ml-2">{isCurrentlyPlaying ? "Pause" : "Play"}</span>}
    </Button>
  );
}
