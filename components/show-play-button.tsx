"use client";

import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import { ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShowPlayButtonProps extends ButtonProps {
  show: any; // Using any to work with both episode and legacy show formats
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
}

export function ShowPlayButton({ show, variant = "outline", size = "icon", className, children, ...props }: ShowPlayButtonProps) {
  const { playShow, selectedShow, isArchivePlaying, pauseShow } = useMediaPlayer();

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isArchivePlaying;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isCurrentlyPlaying) {
      pauseShow();
    } else {
      playShow(show);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} className={cn(size === "icon" && "size-8 rounded-full", className)} {...props}>
      {children ? children : isCurrentlyPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
    </Button>
  );
}
