"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Play, Pause } from "lucide-react";
import { useMediaPlayer } from "./providers/media-player-provider";

const ArchivePlayer: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const { selectedMixcloudUrl, setSelectedMixcloudUrl, selectedShow, setSelectedShow } = useMediaPlayer();

  useEffect(() => {
    if (!selectedMixcloudUrl || !selectedShow) {
      return;
    }

    setHasError(false);
    setIsPlaying(true); // Start as playing

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
              widgetRef.current = widget;

              widget.ready
                .then(() => {
                  // Set up event listeners
                  widget.events.play.on(() => setIsPlaying(true));
                  widget.events.pause.on(() => setIsPlaying(false));
                  widget.events.ended.on(() => setIsPlaying(false));
                })
                .catch(() => {
                  // Widget API failed, but iframe should still work
                });
            }
          } catch (err) {
            console.log("Widget API not available, using iframe only");
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to initialize Mixcloud widget:", error);
      setHasError(true);
    }
  };

  const handlePlayPause = () => {
    if (widgetRef.current) {
      try {
        if (isPlaying) {
          widgetRef.current.pause();
        } else {
          widgetRef.current.play();
        }
      } catch (err) {
        console.log("Widget control not available");
      }
    }
  };

  const handleClose = () => {
    if (widgetRef.current) {
      try {
        widgetRef.current.pause();
      } catch (err) {
        // Ignore if widget control not available
      }
    }
    setSelectedMixcloudUrl(null);
    setSelectedShow(null);
    setIsPlaying(false);
    widgetRef.current = null;
  };

  if (!selectedMixcloudUrl || !selectedShow) {
    return null;
  }

  if (hasError) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-red-50 border-t border-red-200 p-4 z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-red-600 font-medium">Failed to load player</p>
              <p className="text-red-500 text-sm">{selectedShow.name}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-red-400 hover:text-red-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hidden iframe for the actual player */}
      <iframe ref={iframeRef} className="hidden" width="100%" height="120" frameBorder="0" allow="autoplay" title="Mixcloud Player" />

      {/* Visible player UI */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto p-4">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <Image src={selectedShow.pictures.large || "/image-placeholder.svg"} alt={selectedShow.name} width={48} height={48} className="object-cover" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-white font-medium truncate">{selectedShow.name}</h3>
              <p className="text-gray-300 text-sm truncate">{selectedShow.user.username}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={handlePlayPause} className="p-2 hover:bg-white/10 rounded-full transition-colors" disabled={!widgetRef.current}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

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
