"use client";

import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import { MixcloudShow } from "@/lib/mixcloud-service";
import { ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlayButtonProps extends ButtonProps {
  show: MixcloudShow;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
  isLive?: boolean;
}

export function PlayButton({ show, variant = "outline", size = "icon", className, children, isLive = false, ...props }: PlayButtonProps) {
  const { playShow, currentShow, isPlaying, pauseShow } = useMediaPlayer();

  const isCurrentShow = currentShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isPlaying;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isCurrentlyPlaying) {
      pauseShow();
    } else {
      playShow(show);
    }
  };

  // For matching the custom play button in media player
  if (variant === "default" && size === "lg") {
    return (
      <button
        onClick={handleClick}
        className={cn("text-white border-t border-white/20 px-4 py-2 rounded-xs uppercase text-sm font-medium w-full", isLive ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-b from-gray-900 to-gray-700", className)}
        style={{
          boxShadow: "0px -2px 1px 0px rgba(255, 255, 255, 0.00) inset, 0px -1px 0px 0px #181B1B inset",
        }}
        {...props}
      >
        {isCurrentlyPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
    );
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} className={cn(size === "icon" && "size-8 rounded-full", className)} {...props}>
      {children ? children : isCurrentlyPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
    </Button>
  );
}
