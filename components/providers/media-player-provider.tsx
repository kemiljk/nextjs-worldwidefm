"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMixcloudShows, MixcloudShow } from "@/lib/mixcloud-service";
import { addHours, isWithinInterval } from "date-fns";

interface MediaPlayerContextType {
  currentShow: MixcloudShow | null;
  isPlaying: boolean;
  volume: number;
  setVolume: (volume: number) => void;
  playShow: (show: MixcloudShow) => void;
  pauseShow: () => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentShow: (show: MixcloudShow | null) => void;
  isLive: boolean;
  archivedShow: MixcloudShow | null;
  setArchivedShow: (show: MixcloudShow | null) => void;
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
  const [archivedShow, setArchivedShow] = useState<MixcloudShow | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shows, setShows] = useState<MixcloudShow[]>([]);
  const [isLive, setIsLive] = useState(false);

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

        // Find the most recent live show
        const now = new Date();
        const liveShow = result.shows.find((show) => {
          const startTime = new Date(show.created_time);
          const endTime = addHours(startTime, 2);
          return isWithinInterval(now, { start: startTime, end: endTime });
        });

        // If there's a live show, set it as current
        if (liveShow) {
          setCurrentShow(liveShow);
          setIsLive(true);
        } else if (result.shows.length > 0) {
          // Otherwise set the most recent show
          setCurrentShow(result.shows[0]);
          setIsLive(false);
        }
      } catch (error) {
        console.error("Failed to load shows:", error);
      }
    };

    loadShows();
  }, []);

  // Check if current show is live
  useEffect(() => {
    if (currentShow) {
      const now = new Date();
      const startTime = new Date(currentShow.created_time);
      const endTime = addHours(startTime, 2);
      const showIsLive = isWithinInterval(now, { start: startTime, end: endTime });
      setIsLive(showIsLive);
    } else {
      setIsLive(false);
    }
  }, [currentShow]);

  const playShow = (show: MixcloudShow) => {
    console.log("Playing show:", show.name);

    // Check if the show is currently live
    const now = new Date();
    const startTime = new Date(show.created_time);
    const endTime = addHours(startTime, 2);
    const showIsLive = isWithinInterval(now, { start: startTime, end: endTime });

    // If it's a live show, play it in the top player
    if (showIsLive) {
      setCurrentShow(show);
      setIsLive(true);
      setIsPlaying(true);
      return;
    }

    // For archived shows, always play in the bottom player
    const isSameShow = archivedShow?.key === show.key;
    if (isSameShow && isPlaying) {
      setIsPlaying(false);
    } else {
      setArchivedShow(show);
      setIsPlaying(true);
    }
  };

  const pauseShow = () => {
    console.log("Pausing show");
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    console.log("Toggle play/pause. Current state:", isPlaying ? "playing" : "paused");
    // Simply toggle the state - direct user interaction ensures browser allows audio
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
        setIsPlaying,
        setCurrentShow,
        isLive,
        archivedShow,
        setArchivedShow,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  );
}
