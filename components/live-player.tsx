"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, Radio, Circle } from "lucide-react";
import { useMediaPlayer } from "@/components/providers/media-player-provider";

export default function LivePlayer() {
  const { currentLiveEvent, isLivePlaying, liveVolume, toggleLivePlayPause, setIsLivePlaying, isLive } = useMediaPlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      audio.volume = liveVolume;
      audioRef.current = audio;
    }
  }, []);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = liveVolume;
    }
  }, [liveVolume]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (isLivePlaying && isLive) {
      // For RadioCult live shows, use the stream URL
      const streamUrl = process.env.NEXT_PUBLIC_RADIOCULT_STREAM_URL;
      if (streamUrl && audioRef.current.src !== streamUrl) {
        audioRef.current.src = streamUrl;
      }
      audioRef.current.play().catch((error) => {
        console.error("Error playing live stream:", error);
        setIsLivePlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isLivePlaying, isLive, setIsLivePlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Show the player even when no live event (resting state)
  const displayName = currentLiveEvent?.showName || "Worldwide FM";
  const displayImage = currentLiveEvent?.imageUrl || "/image-placeholder.svg?w=40&h=40";

  return (
    <div className="fixed top-0 bg-gray-950 text-white z-50 flex items-center transition-all duration-300 h-12 left-0 right-0 max-w-full px-4">
      <div className="flex items-center mx-2 gap-3 overflow-hidden">
        <div className="w-10 h-10 rounded overflow-hidden z-10 flex-shrink-0 relative">
          <Image src={displayImage} alt={displayName} fill className="object-cover" />
          {isLive && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-crimson-500 animate-pulse" />
                <Radio className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>
        <div>
          <div ref={titleRef} className="text-sm whitespace-nowrap">
            {displayName}
          </div>
          {isLive ? (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-crimson-500 animate-pulse" />
              <span className="text-xs text-white/90 uppercase">On air</span>
            </div>
          ) : (
            <div className="text-xs text-white/60">Nothing currently live</div>
          )}
        </div>
      </div>

      <div className="border-l border-white/20 pl-4 ml-4 flex items-center flex-shrink-0 transition-opacity duration-200">
        <button className={`rounded-full ${isLive ? "text-crimson-500" : "text-white/50"}`} onClick={toggleLivePlayPause} disabled={!isLive}>
          {isLivePlaying ? <Pause className="h-5 w-5" /> : isLive ? <Circle className="h-5 w-5 animate-pulse text-crimson-500" /> : <Play className="h-5 w-5 text-white/50" />}
        </button>
      </div>
    </div>
  );
}
