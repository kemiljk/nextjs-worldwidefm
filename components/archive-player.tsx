"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, X } from "lucide-react";
import { useMediaPlayer } from "@/components/providers/media-player-provider";

export default function ArchivePlayer() {
  const { archivedShow, isPlaying, volume, togglePlayPause, setIsPlaying, setArchivedShow } = useMediaPlayer();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mixcloudWidget, setMixcloudWidget] = useState<any>(null);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Initialize Mixcloud widget
  useEffect(() => {
    if (!scriptLoaded) return;

    // Create iframe if it doesn't exist
    if (!iframeRef.current && containerRef.current) {
      console.log("Creating persistent Mixcloud iframe");

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.bottom = "0";
      iframe.style.right = "0";
      iframe.style.width = "2px";
      iframe.style.height = "2px";
      iframe.style.opacity = "0.01";
      iframe.style.pointerEvents = "none";
      iframe.style.zIndex = "-1";
      iframe.allow = "autoplay";
      iframe.title = "Mixcloud Player";

      containerRef.current.appendChild(iframe);
      iframeRef.current = iframe;
    }

    // Function to load a specific show into the player
    const loadShow = (showKey: string) => {
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
              });

              widget.events.pause.on(() => {
                console.log("Widget event: pause");
              });

              widget.events.error.on((error: any) => {
                console.error("Widget event: error", error);
              });

              widget
                .setVolume(volume)
                .then(() => {
                  console.log("Volume set on widget");
                  setMixcloudWidget(widget);
                  setIsWidgetReady(true);
                })
                .catch((err) => {
                  console.error("Error setting volume:", err);
                  setMixcloudWidget(widget);
                  setIsWidgetReady(true);
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

    // Load the current show when it changes
    if (archivedShow) {
      loadShow(archivedShow.key);
    }

    return () => {
      console.log("Cleaning up Mixcloud widget on unmount");
    };
  }, [archivedShow, scriptLoaded, volume]);

  // Handle playback state changes
  useEffect(() => {
    if (!mixcloudWidget || !isWidgetReady) return;

    console.log(`Handle playback change to ${isPlaying ? "playing" : "paused"}`);

    if (isPlaying) {
      setTimeout(() => {
        try {
          console.log("Calling play() on Mixcloud widget");
          mixcloudWidget
            .play()
            .then(() => {
              console.log("Play successful");
              mixcloudWidget.setVolume(volume);
            })
            .catch((err: any) => {
              console.error("Play failed:", err);
            });
        } catch (err) {
          console.error("Exception during play attempt:", err);
        }
      }, 100);
    } else {
      try {
        console.log("Calling pause() on Mixcloud widget");
        mixcloudWidget.pause();
      } catch (err) {
        console.error("Exception during pause attempt:", err);
      }
    }
  }, [isPlaying, mixcloudWidget, isWidgetReady, volume]);

  // Handle volume changes
  useEffect(() => {
    if (!mixcloudWidget) return;

    console.log("Volume changed, applying to widget:", volume);
    mixcloudWidget.setVolume(volume).catch((err: any) => {
      console.error("Error setting volume:", err);
    });
  }, [volume, mixcloudWidget]);

  // Handle messages from widget
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://player-widget.mixcloud.com") return;

      try {
        const data = JSON.parse(event.data);

        if (data.type === "ready" && data.mixcloud === "playerWidget") {
          setIsWidgetReady(true);

          if (isPlaying && mixcloudWidget) {
            mixcloudWidget.play().catch((err: any) => {
              console.error("Error playing after widget ready:", err);
            });
          }
        }

        if (data.type === "event" && data.data?.eventName === "play") {
          setIsPlaying(true);
        } else if (data.type === "event" && data.data?.eventName === "pause") {
          setIsPlaying(false);
        }
      } catch (e) {
        console.log("Received non-JSON message from widget");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isPlaying, mixcloudWidget, setIsPlaying]);

  // If no archived show or not playing, don't render the player
  if (!archivedShow || !isPlaying) return null;

  const handleDismiss = () => {
    if (mixcloudWidget) {
      mixcloudWidget.pause();
    }
    setArchivedShow(null);
    setIsPlaying(false);
  };

  return (
    <>
      <div ref={containerRef} className="hidden" />
      <div className="fixed bottom-0 bg-gray-950 text-white z-40 flex items-center transition-all duration-300 h-12 left-0 right-0 max-w-full px-4">
        <>
          <div className="flex items-center mx-2 gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded overflow-hidden z-10 flex-shrink-0 relative">
              <Image src={archivedShow?.pictures.large || "/image-placeholder.svg?w=40&h=40"} alt={archivedShow?.name || "Now playing"} fill className="object-cover" />
            </div>
            <div>
              <div ref={titleRef} className="text-sm whitespace-nowrap">
                {archivedShow?.name || "No show playing"}
              </div>
            </div>
          </div>

          <div className={`border-l border-white/20 pl-4 ml-4 flex items-center flex-shrink-0 transition-opacity duration-200`}>
            <button className="text-white rounded-full" onClick={togglePlayPause}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          </div>

          <div className="border-l border-white/20 pl-4 ml-4 flex items-center flex-shrink-0">
            <button className="text-white/70 hover:text-white transition-colors" onClick={handleDismiss}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </>
      </div>
    </>
  );
}
