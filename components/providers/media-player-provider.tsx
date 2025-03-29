"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMixcloudShows, MixcloudShow } from "@/lib/mixcloud-service";

interface MediaPlayerContextType {
  currentShow: MixcloudShow | null;
  isPlaying: boolean;
  volume: number;
  setVolume: (volume: number) => void;
  playShow: (show: MixcloudShow) => void;
  pauseShow: () => void;
  togglePlayPause: () => void;
}

const MediaPlayerContext = createContext<MediaPlayerContextType | undefined>(undefined);

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);
  if (context === undefined) {
    throw new Error("useMediaPlayer must be used within a MediaPlayerProvider");
  }
  return context;
}

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const [currentShow, setCurrentShow] = useState<MixcloudShow | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shows, setShows] = useState<MixcloudShow[]>([]);

  // Initialize volume from localStorage or use default
  const [volume, setVolumeState] = useState<number>(() => {
    // Only run in browser
    if (typeof window !== "undefined") {
      const savedVolume = localStorage.getItem("mixcloud-player-volume");
      return savedVolume ? parseFloat(savedVolume) : 1; // Default to 1 if not found
    }
    return 1;
  });

  // Update localStorage when volume changes
  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if (typeof window !== "undefined") {
      localStorage.setItem("mixcloud-player-volume", newVolume.toString());
    }
  };

  // Load initial shows
  useEffect(() => {
    const loadShows = async () => {
      try {
        const result = await getMixcloudShows();
        setShows(result.shows);
        if (result.shows.length > 0 && !currentShow) {
          setCurrentShow(result.shows[0]);
        }
      } catch (error) {
        console.error("Failed to load shows:", error);
      }
    };

    loadShows();
  }, []);

  const playShow = (show: MixcloudShow) => {
    console.log("Playing show:", show.name);

    // First set the current show
    setCurrentShow(show);

    // Set playing state (this will trigger the useEffect in the player component)
    setIsPlaying(true);
  };

  const pauseShow = () => {
    console.log("Pausing show");
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    console.log("Toggle play/pause. Current state:", isPlaying ? "playing" : "paused");
    setIsPlaying(!isPlaying);
  };

  return (
    <MediaPlayerContext.Provider
      value={{
        currentShow,
        isPlaying,
        volume,
        setVolume,
        playShow,
        pauseShow,
        togglePlayPause,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  );
}
