"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { addHours, isWithinInterval } from "date-fns";
import { useMediaPlayer } from "@/components/providers/media-player-provider";

export default function MediaPlayer() {
  const { currentShow, isPlaying, volume, setVolume, togglePlayPause } = useMediaPlayer();
  const [isExpanded, setIsExpanded] = useState(true);
  const [needsMarquee, setNeedsMarquee] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mixcloudWidget, setMixcloudWidget] = useState<any>(null);
  const [volumeControlOpen, setVolumeControlOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);

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

  // Check if show is currently live
  useEffect(() => {
    if (currentShow) {
      const now = new Date();
      const startTime = new Date(currentShow.created_time);
      const endTime = addHours(startTime, 2); // Assume 2-hour shows
      const showIsLive = isWithinInterval(now, { start: startTime, end: endTime });
      setIsLive(showIsLive);
    } else {
      setIsLive(false);
    }
  }, [currentShow]);

  // Initialize Mixcloud widget
  useEffect(() => {
    if (!currentShow || !containerRef.current || !scriptLoaded) return;

    console.log("Initializing Mixcloud widget for show:", currentShow.name);

    try {
      // Create iframe if it doesn't exist
      if (!iframeRef.current) {
        console.log("Creating iframe for Mixcloud widget");
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.top = "-100vh";
        iframe.style.left = "0";
        iframe.style.width = "100%";
        iframe.style.height = "60px";
        iframe.style.border = "none";
        iframe.allow = "autoplay";
        containerRef.current.appendChild(iframe);
        iframeRef.current = iframe;
      }

      // Set up the widget URL with feed format - add initial volume parameter
      const widgetUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(currentShow.key)}&hide_cover=1&mini=1&hide_artwork=1&autoplay=0&light=1&initial_volume=${volume}`;
      console.log("Setting widget URL:", widgetUrl);

      if (iframeRef.current.src !== widgetUrl) {
        iframeRef.current.src = widgetUrl;

        iframeRef.current.onload = () => {
          console.log("Iframe loaded, initializing Mixcloud widget");
          if (window.Mixcloud && iframeRef.current) {
            try {
              const widget = window.Mixcloud.PlayerWidget(iframeRef.current);

              widget.ready
                .then(() => {
                  console.log("Mixcloud widget ready");

                  // Store the widget
                  setMixcloudWidget(widget);

                  // CRITICAL: Register play event listener BEFORE any other operations
                  widget.events.play.on(() => {
                    console.log("Widget event: play - IMMEDIATELY setting volume to", volume);

                    // Set volume IMMEDIATELY on play event
                    widget.setVolume(volume).catch((err: any) => {
                      console.error("Error setting volume on play event:", err);
                    });

                    // Try again with slight delay for reliability
                    setTimeout(() => {
                      widget.setVolume(volume).catch((err: any) => {
                        console.error("Error setting delayed volume after play:", err);
                      });
                    }, 100);
                  });

                  widget.events.pause.on(() => {
                    console.log("Widget event: pause");
                  });

                  widget.events.ended.on(() => {
                    console.log("Widget event: ended");
                  });

                  widget.events.error.on((error: any) => {
                    console.error("Widget event: error", error);
                  });

                  // Set initial volume (although this may not persist through playback)
                  widget
                    .setVolume(volume)
                    .then(() => {
                      console.log("Initial volume set:", volume);
                    })
                    .catch((err: any) => {
                      console.error("Error setting initial volume:", err);
                    });
                })
                .catch((error: any) => {
                  console.error("Failed to initialize widget:", error);
                });
            } catch (error) {
              console.error("Error setting up Mixcloud widget:", error);
            }
          } else {
            console.error("Mixcloud API not available");
          }
        };
      }
    } catch (error) {
      console.error("Error initializing Mixcloud widget:", error);
    }

    return () => {
      console.log("Cleaning up Mixcloud widget");
      if (iframeRef.current) {
        iframeRef.current.remove();
        iframeRef.current = null;
        setMixcloudWidget(null);
      }
    };
  }, [currentShow, scriptLoaded, volume]);

  // Handle playback state changes
  useEffect(() => {
    if (!mixcloudWidget || !iframeRef.current) return;

    if (isPlaying) {
      console.log("Calling widget.play() with desired volume:", volume);

      // First set volume directly
      mixcloudWidget.setVolume(volume).catch((err: any) => {
        console.error("Error setting volume before play:", err);
      });

      // Also try direct iframe messaging as a backup
      try {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({
            method: "setVolume",
            params: { volume },
          }),
          "*"
        );
      } catch (err) {
        console.error("Error with postMessage volume:", err);
      }

      // Then play the widget
      mixcloudWidget
        .play()
        .then(() => {
          console.log("Play successful, reinforcing volume");

          // Try both methods again after successful play
          mixcloudWidget.setVolume(volume).catch((err: any) => {
            console.error("Error setting volume after play:", err);
          });

          try {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({
                method: "setVolume",
                params: { volume },
              }),
              "*"
            );
          } catch (err) {
            console.error("Error with postMessage volume after play:", err);
          }
        })
        .catch((err: any) => {
          console.error("Error playing widget:", err);
        });
    } else {
      console.log("Calling widget.pause()");
      mixcloudWidget.pause().catch((err: any) => {
        console.error("Error pausing widget:", err);
      });
    }
  }, [isPlaying, mixcloudWidget, volume, iframeRef]);

  // Handle volume changes
  useEffect(() => {
    if (!mixcloudWidget) return;

    console.log("Volume changed, applying to widget:", volume);
    mixcloudWidget.setVolume(volume).catch((err: any) => {
      console.error("Error setting volume:", err);
    });
  }, [volume, mixcloudWidget]);

  // Handle messages from widget for older implementation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://player-widget.mixcloud.com") return;

      console.log("Received message from Mixcloud widget:", event.data);

      try {
        const data = JSON.parse(event.data);
        console.log("Parsed message data:", data);
      } catch (e) {
        console.log("Received non-JSON message from widget");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Check if title needs marquee effect
  useEffect(() => {
    if (titleRef.current) {
      const container = titleRef.current.parentElement;
      if (container && titleRef.current.scrollWidth > container.clientWidth) {
        setNeedsMarquee(true);
      } else {
        setNeedsMarquee(false);
      }
    }
  }, [currentShow, isExpanded]);

  // Handle transition state
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  // Close volume control when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeControlRef.current && !volumeControlRef.current.contains(event.target as Node)) {
        setVolumeControlOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleExpanded = () => {
    setIsTransitioning(true);
    setIsExpanded(!isExpanded);
  };

  const toggleVolumeControl = () => {
    setVolumeControlOpen(!volumeControlOpen);
  };

  const handleVolumeChange = (value: number[]) => {
    console.log("Volume changed to:", value[0]);
    setVolume(value[0]);
  };

  // If no current show, don't render the player
  if (!currentShow) return null;

  return (
    <div className={`fixed bottom-0 left-0 ${isExpanded ? "max-w-full" : "max-w-[6.7rem]"} w-full bg-green-500 dark:bg-green-700 text-white rounded-none border-t border-green-900 z-50 flex items-center px-4 py-3 transition-all duration-300`}>
      <div ref={containerRef} className="hidden" /> {/* Container for hidden iframe */}
      <Button variant="ghost" className="text-white hover:bg-white/10 p-2 mr-2 flex-shrink-0" onClick={toggleExpanded}>
        {isExpanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </Button>
      {isExpanded ? (
        <>
          <div className="flex items-center flex-1 mx-2 overflow-hidden">
            <div className="w-10 h-10 rounded overflow-hidden mr-3 flex-shrink-0 relative">
              <Image src={currentShow?.pictures.large || "/image-placeholder.svg?w=40&h=40"} alt={currentShow?.name || "Now playing"} fill className="object-cover" />
              {isLive && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <Radio className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div ref={titleRef} className={`font-medium whitespace-nowrap ${isPlaying && needsMarquee ? "animate-marquee" : "truncate"}`}>
                {currentShow?.name || "No show playing"}
              </div>
              <div className="flex items-center gap-2">
                {isLive && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-white/90">LIVE</span>
                  </div>
                )}
                {currentShow?.tags && currentShow.tags.length > 0 && (
                  <div className="text-sm text-white/70 truncate flex items-center gap-2">
                    {currentShow.tags
                      .map((tag) => (
                        <span key={tag.key} className="text-xs bg-white/10 px-2 py-0.5 rounded-full">
                          {tag.name}
                        </span>
                      ))
                      .slice(0, 2)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div ref={volumeControlRef} className={`relative flex items-center gap-2 transition-opacity duration-200 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
            <Button variant="ghost" className="text-white hover:bg-white/10 flex-shrink-0 p-2" onClick={toggleVolumeControl} aria-label="Volume control">
              <Volume2 className="h-5 w-5" />
            </Button>

            {/* Desktop horizontal slider (hidden on mobile when menu closed) */}
            <div className="w-24 mr-2 hidden md:block">
              <Slider defaultValue={[1]} max={1} step={0.1} value={[volume]} onValueChange={handleVolumeChange} className="cursor-pointer" />
            </div>

            {/* Mobile horizontal slider popup */}
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-green-600 dark:bg-green-800 p-3 rounded-lg shadow-lg md:hidden transition-all duration-300 ${volumeControlOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
              <div className="w-[140px]">
                <Slider defaultValue={[1]} max={1} step={0.01} value={[volume]} onValueChange={handleVolumeChange} className="cursor-pointer" />
              </div>
            </div>
          </div>

          <div className={`border-l border-white/20 pl-2 flex items-center gap-2 flex-shrink-0 transition-opacity duration-200 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
            <button
              className={`text-white border-t border-white px-4 py-2 rounded-xs uppercase text-sm font-medium custom-play-button ${isLive ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-b from-gray-900 to-gray-700"}`}
              style={{
                boxShadow: "0px -2px 1px 0px rgba(255, 255, 255, 0.00) inset, 0px -1px 0px 0px #181B1B inset",
              }}
              onClick={togglePlayPause}
            >
              {isPlaying ? "STOP" : isLive ? "LISTEN LIVE" : "PLAY"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center">
          <div className="w-10 h-10 rounded overflow-hidden relative">
            <Image src={currentShow?.pictures.large || "/image-placeholder.svg?w=40&h=40"} alt={currentShow?.name || "Now playing"} fill className="object-cover" />
            {isLive && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </div>
            )}
            <button onClick={togglePlayPause} className="absolute inset-0 bg-black/30 flex items-center justify-center hover:bg-black/40 transition-colors">
              {isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
