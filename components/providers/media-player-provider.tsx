"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface Show {
  key: string;
  name: string;
  url: string;
  slug: string;
  pictures: {
    large: string;
    medium: string;
    small: string;
  };
  user: {
    name: string;
    username: string;
  };
  created_time: string;
}

interface MediaPlayerContextType {
  // Live player state
  isLivePlaying: boolean;
  setIsLivePlaying: (playing: boolean) => void;

  // Archive player state
  selectedMixcloudUrl: string | null;
  setSelectedMixcloudUrl: (url: string | null) => void;
  selectedShow: Show | null;
  setSelectedShow: (show: Show | null) => void;

  // Global controls
  stopAllPlayers: () => void;
}

const MediaPlayerContext = createContext<MediaPlayerContextType | undefined>(undefined);

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [selectedMixcloudUrl, setSelectedMixcloudUrl] = useState<string | null>(null);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);

  const stopAllPlayers = () => {
    setIsLivePlaying(false);
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
  };

  const handleSetSelectedMixcloudUrl = (url: string | null) => {
    if (url) {
      setIsLivePlaying(false); // Stop live player when archive starts
    }
    setSelectedMixcloudUrl(url);
  };

  const handleSetIsLivePlaying = (playing: boolean) => {
    if (playing) {
      setSelectedMixcloudUrl(null); // Stop archive player when live starts
      setSelectedShow(null);
    }
    setIsLivePlaying(playing);
  };

  return (
    <MediaPlayerContext.Provider
      value={{
        isLivePlaying,
        setIsLivePlaying: handleSetIsLivePlaying,
        selectedMixcloudUrl,
        setSelectedMixcloudUrl: handleSetSelectedMixcloudUrl,
        selectedShow,
        setSelectedShow,
        stopAllPlayers,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);
  if (context === undefined) {
    throw new Error("useMediaPlayer must be used within a MediaPlayerProvider");
  }
  return context;
}
