'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

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

interface LiveEvent {
  // Define a more specific type if available
  showName?: string;
  [key: string]: any;
}

interface MediaPlayerContextType {
  // Live player state
  isLivePlaying: boolean;
  setIsLivePlaying: (playing: boolean) => void;

  // Live playback controls (RadioCult)
  currentLiveEvent: LiveEvent | null;
  playLive: (event: LiveEvent) => void;
  pauseLive: () => void;
  liveVolume: number;
  setLiveVolume: (volume: number) => void;

  // Archive player state
  selectedMixcloudUrl: string | null;
  setSelectedMixcloudUrl: (url: string | null) => void;
  selectedShow: Show | null;
  setSelectedShow: (show: Show | null) => void;

  // Global controls
  stopAllPlayers: () => void;

  // Playback controls
  playShow: (show: Show) => void;
  pauseShow: () => void;

  // New: Archive player state
  isArchivePlaying: boolean;

  // Widget control
  setWidgetRef: (widget: any) => void;
  widgetRef: any;
}

const MediaPlayerContext = createContext<MediaPlayerContextType | undefined>(undefined);

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [currentLiveEvent, setCurrentLiveEvent] = useState<LiveEvent | null>(null);
  const [liveVolume, setLiveVolume] = useState<number>(1);
  const [selectedMixcloudUrl, setSelectedMixcloudUrl] = useState<string | null>(null);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [isArchivePlaying, setIsArchivePlaying] = useState(false);
  const [widgetRef, setWidgetRef] = useState<any>(null);

  const stopAllPlayers = () => {
    setIsLivePlaying(false);
    setCurrentLiveEvent(null);
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    setIsArchivePlaying(false);
    setWidgetRef(null);
  };

  const handleSetSelectedMixcloudUrl = (url: string | null) => {
    if (url) {
      setIsLivePlaying(false); // Stop live player when archive starts
      setCurrentLiveEvent(null);
    }
    setSelectedMixcloudUrl(url);
  };

  const handleSetIsLivePlaying = (playing: boolean) => {
    if (playing) {
      setSelectedMixcloudUrl(null); // Stop archive player when live starts
      setSelectedShow(null);
      setIsArchivePlaying(false);
      setWidgetRef(null);
    }
    setIsLivePlaying(playing);
  };

  // New: Play and pause controls for archive
  const playShow = (show: Show) => {
    setSelectedMixcloudUrl(show.url);
    setSelectedShow(show);
    setIsArchivePlaying(true);
    if (widgetRef) {
      widgetRef.play?.();
    }
  };

  const pauseShow = () => {
    setIsArchivePlaying(false);
    if (widgetRef) {
      widgetRef.pause?.();
    }
  };

  // Live playback controls for RadioCult
  const playLive = (event: LiveEvent) => {
    setCurrentLiveEvent(event);
    setIsLivePlaying(true);
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    setIsArchivePlaying(false);
  };

  const pauseLive = () => {
    setIsLivePlaying(false);
  };

  return (
    <MediaPlayerContext.Provider
      value={{
        isLivePlaying,
        setIsLivePlaying: handleSetIsLivePlaying,
        currentLiveEvent,
        playLive,
        pauseLive,
        liveVolume,
        setLiveVolume,
        selectedMixcloudUrl,
        setSelectedMixcloudUrl: handleSetSelectedMixcloudUrl,
        selectedShow,
        setSelectedShow,
        stopAllPlayers,
        playShow,
        pauseShow,
        isArchivePlaying,
        setWidgetRef,
        widgetRef,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);
  if (context === undefined) {
    throw new Error('useMediaPlayer must be used within a MediaPlayerProvider');
  }
  return context;
}
