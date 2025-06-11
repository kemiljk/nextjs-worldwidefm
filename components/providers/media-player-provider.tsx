"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMixcloudShows, MixcloudShow } from "@/lib/mixcloud-service";
import { getEvents, RadioCultEvent } from "@/lib/radiocult-service";
import { addHours, isWithinInterval } from "date-fns";

interface MediaPlayerContextType {
  // Live player state (RadioCult only)
  currentLiveEvent: RadioCultEvent | null;
  isLivePlaying: boolean;
  liveVolume: number;
  setLiveVolume: (volume: number) => void;
  toggleLivePlayPause: () => void;
  setIsLivePlaying: (playing: boolean) => void;
  setCurrentLiveEvent: (event: RadioCultEvent | null) => void;
  isLive: boolean;

  // Archive player state (Mixcloud only)
  archivedShow: MixcloudShow | null;
  isArchivePlaying: boolean;
  archiveVolume: number;
  setArchiveVolume: (volume: number) => void;
  playArchiveShow: (show: MixcloudShow) => void;
  pauseArchiveShow: () => void;
  toggleArchivePlayPause: () => void;
  setIsArchivePlaying: (playing: boolean) => void;
  setArchivedShow: (show: MixcloudShow | null) => void;

  // Legacy methods for backward compatibility
  playShow: (show: MixcloudShow) => void;
  currentShow: MixcloudShow | null;
  isPlaying: boolean;
  volume: number;
  setVolume: (volume: number) => void;
  pauseShow: () => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentShow: (show: MixcloudShow | null) => void;
}

const MediaPlayerContext = createContext<MediaPlayerContextType | undefined>(undefined);

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);
  if (!context) {
    throw new Error("useMediaPlayer must be used within a MediaPlayerProvider");
  }
  return context;
}

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  // Live player state (RadioCult only)
  const [currentLiveEvent, setCurrentLiveEvent] = useState<RadioCultEvent | null>(null);
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Archive player state (Mixcloud only)
  const [archivedShow, setArchivedShow] = useState<MixcloudShow | null>(null);
  const [isArchivePlaying, setIsArchivePlaying] = useState(false);

  // Initialize volumes from localStorage or use defaults
  const [liveVolume, setLiveVolumeState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const savedVolume = localStorage.getItem("live-player-volume");
      return savedVolume ? parseFloat(savedVolume) : 1;
    }
    return 1;
  });

  const [archiveVolume, setArchiveVolumeState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const savedVolume = localStorage.getItem("archive-player-volume");
      return savedVolume ? parseFloat(savedVolume) : 1;
    }
    return 1;
  });

  // Update localStorage when volumes change
  const setLiveVolume = (newVolume: number) => {
    setLiveVolumeState(newVolume);
    if (typeof window !== "undefined") {
      localStorage.setItem("live-player-volume", newVolume.toString());
    }
  };

  const setArchiveVolume = (newVolume: number) => {
    setArchiveVolumeState(newVolume);
    if (typeof window !== "undefined") {
      localStorage.setItem("archive-player-volume", newVolume.toString());
    }
  };

  // Load RadioCult events and check for live shows
  useEffect(() => {
    const loadLiveEvents = async () => {
      try {
        // More robust check for RadioCult configuration
        // Since we're on the client side, we need to check if the service is actually configured
        // by attempting a minimal call and catching configuration errors specifically

        console.log("Checking for live RadioCult events...");
        const result = await getEvents();

        if (!result || !result.events) {
          console.log("No events returned from RadioCult API");
          setIsLive(false);
          return;
        }

        const events = result.events;

        // Find currently live RadioCult event
        const now = new Date();
        const liveEvent = events.find((event: RadioCultEvent) => {
          const startTime = new Date(event.startTime);
          const endTime = new Date(event.endTime);
          return isWithinInterval(now, { start: startTime, end: endTime });
        });

        if (liveEvent) {
          console.log("Found live event:", liveEvent.showName);
          setCurrentLiveEvent(liveEvent);
          setIsLive(true);
        } else {
          console.log("No currently live events found");
          setIsLive(false);
          // Keep the current event for display in resting state
        }
      } catch (error) {
        // Check if this is a configuration error vs a real API error
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("not provided") || errorMessage.includes("not configured")) {
          console.log("RadioCult not configured, skipping live events");
          setIsLive(false);
          setCurrentLiveEvent(null);
          return; // Don't retry if it's a configuration issue
        }

        console.warn("Failed to load RadioCult events (this won't affect archive playback):", error);
        setIsLive(false);
        // Don't clear the current event, just mark as not live
      }
    };

    // Load events immediately
    loadLiveEvents();

    // Check for live events every minute, but don't let errors stop the interval
    const interval = setInterval(() => {
      loadLiveEvents().catch((error) => {
        // Don't log configuration errors repeatedly
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("not provided") && !errorMessage.includes("not configured")) {
          console.warn("Live events check failed, will retry in 1 minute:", error);
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Check if current live event is still live
  useEffect(() => {
    if (currentLiveEvent) {
      const now = new Date();
      const startTime = new Date(currentLiveEvent.startTime);
      const endTime = new Date(currentLiveEvent.endTime);
      const eventIsLive = isWithinInterval(now, { start: startTime, end: endTime });
      setIsLive(eventIsLive);

      // If event is no longer live, stop playing but keep it displayed for resting state
      if (!eventIsLive && isLivePlaying) {
        setIsLivePlaying(false);
      }
    } else {
      setIsLive(false);
    }
  }, [currentLiveEvent, isLivePlaying]);

  // Live player controls (RadioCult only)
  const toggleLivePlayPause = () => {
    setIsLivePlaying(!isLivePlaying);
  };

  // Archive player controls (Mixcloud only)
  const playArchiveShow = (show: MixcloudShow) => {
    console.log("Playing archive show:", show.name);

    // Check if it's the same show that's already selected
    const isSameShow = archivedShow?.key === show.key;
    if (isSameShow && isArchivePlaying) {
      // If same show is playing, pause it
      setIsArchivePlaying(false);
    } else {
      // Set the archived show but don't immediately set playing state
      // Let the ArchivePlayer handle playing once the widget is ready
      setArchivedShow(show);
      // Only set playing to true if it's the same show (toggle play/pause)
      // For new shows, the ArchivePlayer will handle the initial play
      if (isSameShow) {
        setIsArchivePlaying(true);
      }
    }
  };

  const pauseArchiveShow = () => {
    setIsArchivePlaying(false);
  };

  const toggleArchivePlayPause = () => {
    setIsArchivePlaying(!isArchivePlaying);
  };

  // Legacy methods for backward compatibility - route to archive player (Mixcloud only)
  const playShow = (show: MixcloudShow) => {
    // All show plays go to archive player since they're Mixcloud shows
    playArchiveShow(show);
  };

  const pauseShow = () => {
    // Pause archive player (live player is controlled separately)
    setIsArchivePlaying(false);
  };

  const togglePlayPause = () => {
    // Toggle archive player if there's an archived show
    if (archivedShow) {
      toggleArchivePlayPause();
    }
  };

  // Legacy getters that return archive player values for backward compatibility
  const currentShow = archivedShow;
  const isPlaying = isArchivePlaying;
  const volume = archiveVolume;

  const setVolume = (newVolume: number) => {
    setArchiveVolume(newVolume);
  };

  const setIsPlaying = (playing: boolean) => {
    setIsArchivePlaying(playing);
  };

  const setCurrentShow = (show: MixcloudShow | null) => {
    setArchivedShow(show);
  };

  return (
    <MediaPlayerContext.Provider
      value={{
        // Live player state (RadioCult)
        currentLiveEvent,
        isLivePlaying,
        liveVolume,
        setLiveVolume,
        toggleLivePlayPause,
        setIsLivePlaying,
        setCurrentLiveEvent,
        isLive,

        // Archive player state (Mixcloud)
        archivedShow,
        isArchivePlaying,
        archiveVolume,
        setArchiveVolume,
        playArchiveShow,
        pauseArchiveShow,
        toggleArchivePlayPause,
        setIsArchivePlaying,
        setArchivedShow,

        // Legacy compatibility (routes to archive/Mixcloud)
        currentShow,
        isPlaying,
        volume,
        setVolume,
        playShow,
        pauseShow,
        togglePlayPause,
        setIsPlaying,
        setCurrentShow,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  );
}
