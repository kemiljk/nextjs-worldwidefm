"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Play, Pause } from "lucide-react";
import { useMediaPlayer } from "./providers/media-player-provider";

const ArchivePlayer: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isWidgetReady, setIsWidgetReady] = useState(false);

  const { selectedMixcloudUrl, setSelectedMixcloudUrl, selectedShow, setSelectedShow, isLivePlaying, playShow, pauseShow, stopAllPlayers, isArchivePlaying, setWidgetRef, widgetRef } = useMediaPlayer();

  const isPlaying = isArchivePlaying;

  // Clear widgetRef and state on show change
  useEffect(() => {
    setWidgetRef(null);
    setIsWidgetReady(false);
  }, [selectedMixcloudUrl, selectedShow, setWidgetRef]);

  useEffect(() => {
    if (!selectedMixcloudUrl || !selectedShow) {
      return;
    }

    setHasError(false);
    setIsWidgetReady(false);

    // Load Mixcloud widget script if not already loaded
    if (!window.Mixcloud) {
      const script = document.createElement("script");
      script.src = "https://widget.mixcloud.com/media/js/widgetApi.js";
      script.async = true;
      script.onload = () => {
        initializeWidget();
      };
      script.onerror = () => {
        setHasError(true);
      };
      document.head.appendChild(script);
    } else {
      initializeWidget();
    }
  }, [selectedMixcloudUrl, selectedShow]);

  const initializeWidget = () => {
    if (!selectedMixcloudUrl || !iframeRef.current) return;

    try {
      // Create widget URL
      const widgetParams = new URLSearchParams({
        feed: selectedMixcloudUrl,
        hide_cover: "1",
        mini: "1",
        autoplay: "1",
        hide_artwork: "0",
        hide_tracklist: "1",
        stylesheets: "",
      });

      const widgetUrl = `https://www.mixcloud.com/widget/iframe/?${widgetParams.toString()}`;

      if (iframeRef.current) {
        iframeRef.current.src = widgetUrl;

        // Try to initialize the widget API for control
        setTimeout(() => {
          try {
            if (window.Mixcloud && iframeRef.current) {
              const widget = window.Mixcloud.PlayerWidget(iframeRef.current);
              setWidgetRef(widget);

              widget.ready
                .then(() => {
                  setIsWidgetReady(true);
                  // Set up event listeners
                  widget.events.play.on(() => {
                    if (selectedShow) playShow(selectedShow);
                  });
                  widget.events.pause.on(() => pauseShow());
                  widget.events.ended.on(() => pauseShow());
                })
                .catch(() => {
                  setIsWidgetReady(false);
                });
            }
          } catch (err) {
            setIsWidgetReady(false);
            console.log("Widget API not available, using iframe only");
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to initialize Mixcloud widget:", error);
      setHasError(true);
      setIsWidgetReady(false);
    }
  };

  const handlePlayPause = () => {
    if (widgetRef && isWidgetReady) {
      try {
        if (isPlaying) {
          widgetRef.pause();
        } else {
          widgetRef.play();
        }
      } catch (err) {
        console.log("Widget control not available");
      }
    }
  };

  const handleClose = () => {
    if (widgetRef && isWidgetReady) {
      try {
        widgetRef.pause();
      } catch (err) {
        // Ignore if widget control not available
      }
    }
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    setIsWidgetReady(false);
    setWidgetRef(null);
    pauseShow();
  };

  if (!selectedMixcloudUrl || !selectedShow) {
    return null;
  }

  if (hasError) {
    return null;
  }

  return (
    <>
      {/* Hidden iframe for the actual player */}
      <iframe ref={iframeRef} className="hidden" width="100%" height="120" frameBorder="0" allow="autoplay" title="Mixcloud Player" />

      {/* Visible player UI */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white z-50">
        <div className="flex items-center justify-between mx-auto p-4">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="w-10 h-10 overflow-hidden shrink-0 relative">
              <Image src={selectedShow.pictures.large || "/image-placeholder.svg"} alt={selectedShow.name} width={48} height={48} className="object-cover" />
              <button onClick={handlePlayPause} className="absolute inset-0 p-2 hover:bg-white/10 rounded-full transition-colors" disabled={!isWidgetReady} aria-label={isPlaying ? `Pause ${selectedShow.name}` : `Play ${selectedShow.name}`}>
                {isPlaying ? <Pause fill="white" className="w-5 h-5" /> : <Play fill="white" className="w-5 h-5" />}
              </button>
            </div>

            <h3 className="text-white font-mono text-m7 truncate">{selectedShow.name}</h3>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={handleClose} className="p-2 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ArchivePlayer;
