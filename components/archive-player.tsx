"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, X } from "lucide-react";
import { useMediaPlayer } from "@/components/providers/media-player-provider";

export default function ArchivePlayer() {
  const { archivedShow, isArchivePlaying, archiveVolume, toggleArchivePlayPause, setIsArchivePlaying, setArchivedShow } = useMediaPlayer();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mixcloudWidget, setMixcloudWidget] = useState<any>(null);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastShowKeyRef = useRef<string | null>(null);

  // Load Mixcloud widget script
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Mixcloud) {
      console.log("Loading Mixcloud widget script");
      const script = document.createElement("script");
      script.src = "https://widget.mixcloud.com/media/js/widgetApi.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        console.log("Mixcloud widget script loaded successfully");
        setScriptLoaded(true);
      };

      script.onerror = (error) => {
        console.error("Failed to load Mixcloud widget script:", error);
      };

      return () => {
        document.body.removeChild(script);
      };
    } else if (window.Mixcloud) {
      console.log("Mixcloud widget script already loaded");
      setScriptLoaded(true);
    }
  }, []);

  // Initialize widget when script is loaded and show is selected
  useEffect(() => {
    if (!scriptLoaded || !archivedShow) return;

    const showKey = archivedShow.key;

    // If it's the same show, don't reinitialize
    if (lastShowKeyRef.current === showKey && mixcloudWidget && isWidgetReady) {
      return;
    }

    const initializeWidget = () => {
      if (!iframeRef.current) return;

      console.log("Loading show:", showKey);
      setIsWidgetReady(false);
      setMixcloudWidget(null);

      const widgetUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(showKey)}&mini=1&hide_artwork=1&autoplay=0`;

      if (iframeRef.current.src !== widgetUrl) {
        console.log("Setting widget URL:", widgetUrl);
        iframeRef.current.src = widgetUrl;
      }

      iframeRef.current.onload = () => {
        if (!window.Mixcloud || !iframeRef.current) return;

        console.log("Iframe loaded, initializing widget");

        try {
          const widget = window.Mixcloud.PlayerWidget(iframeRef.current);

          widget.ready
            .then(() => {
              console.log("Mixcloud widget ready for show:", showKey);

              widget.events.play.on(() => {
                console.log("Widget event: play");
                setIsArchivePlaying(true);
              });

              widget.events.pause.on(() => {
                console.log("Widget event: pause");
                setIsArchivePlaying(false);
              });

              widget.events.error.on((error: any) => {
                console.error("Widget event: error", error);
              });

              widget
                .setVolume(archiveVolume)
                .then(() => {
                  console.log("Volume set on widget");
                  setMixcloudWidget(widget);
                  setIsWidgetReady(true);
                  lastShowKeyRef.current = showKey;

                  // Auto-play the new show with a small delay to ensure widget is fully ready
                  setTimeout(() => {
                    console.log("Auto-playing new archive show");
                    widget
                      .play()
                      .then(() => {
                        console.log("Auto-play successful");
                        setIsArchivePlaying(true);
                      })
                      .catch((err) => {
                        console.error("Auto-play failed:", err);
                      });
                  }, 100);
                })
                .catch((err) => {
                  console.error("Error setting volume:", err);
                  setMixcloudWidget(widget);
                  setIsWidgetReady(true);
                  lastShowKeyRef.current = showKey;

                  // Try auto-play even if volume setting failed
                  setTimeout(() => {
                    widget
                      .play()
                      .then(() => {
                        setIsArchivePlaying(true);
                      })
                      .catch((playErr) => {
                        console.error("Auto-play failed after volume error:", playErr);
                      });
                  }, 100);
                });
            })
            .catch((error) => {
              console.error("Widget initialization failed:", error);
              setIsWidgetReady(true);
            });
        } catch (error) {
          console.error("Error creating widget:", error);
          setIsWidgetReady(true);
        }
      };
    };

    initializeWidget();
  }, [scriptLoaded, archivedShow, archiveVolume]);

  // Handle volume changes
  useEffect(() => {
    if (mixcloudWidget && isWidgetReady) {
      mixcloudWidget.setVolume(archiveVolume).catch((error: any) => {
        console.error("Error setting volume:", error);
      });
    }
  }, [archiveVolume, mixcloudWidget, isWidgetReady]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!mixcloudWidget || !isWidgetReady) return;

    if (isArchivePlaying) {
      mixcloudWidget.play().catch((error: any) => {
        console.error("Error playing:", error);
        setIsArchivePlaying(false);
      });
    } else {
      mixcloudWidget.pause().catch((error: any) => {
        console.error("Error pausing:", error);
      });
    }
  }, [isArchivePlaying, mixcloudWidget, isWidgetReady, setIsArchivePlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mixcloudWidget) {
        try {
          mixcloudWidget.pause();
        } catch (error) {
          console.error("Error pausing widget on cleanup:", error);
        }
      }
    };
  }, [mixcloudWidget]);

  const handleDismiss = () => {
    if (mixcloudWidget) {
      try {
        mixcloudWidget.pause();
      } catch (error) {
        console.error("Error pausing widget:", error);
      }
    }
    setArchivedShow(null);
    setIsArchivePlaying(false);
  };

  // Don't render if no archived show is selected (AFTER all hooks)
  if (!archivedShow) {
    return null;
  }

  return (
    <>
      <div ref={containerRef} className="hidden" />
      <iframe ref={iframeRef} className="hidden" width="100%" height="60" frameBorder="0" allow="autoplay" />
      <div className="fixed bottom-0 bg-gray-950 text-white z-50 flex items-center transition-all duration-300 h-12 left-0 right-0 max-w-full px-4">
        <div className="flex items-center mx-2 gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded overflow-hidden z-10 flex-shrink-0 relative">
            <Image src={archivedShow.pictures.large || "/image-placeholder.svg?w=40&h=40"} alt={archivedShow.name} fill className="object-cover" />
          </div>
          <div>
            <div ref={titleRef} className="text-sm whitespace-nowrap">
              {archivedShow.name}
            </div>
            <div className="text-xs text-white/60">Archive</div>
          </div>
        </div>

        <div className="border-l border-white/20 pl-4 ml-4 flex items-center flex-shrink-0 transition-opacity duration-200">
          <button className="text-white rounded-full" onClick={toggleArchivePlayPause}>
            {isArchivePlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
        </div>

        <div className="border-l border-white/20 pl-4 flex ml-auto items-center flex-shrink-0">
          <button className="text-white/70 hover:text-white transition-colors" onClick={handleDismiss}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}
