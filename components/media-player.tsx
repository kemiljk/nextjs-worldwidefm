"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { addHours, isWithinInterval } from "date-fns";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import Marquee from "./ui/marquee";

export default function MediaPlayer() {
  const { currentShow, isPlaying, volume, setVolume, togglePlayPause } = useMediaPlayer();
  const [isExpanded, setIsExpanded] = useState(true);
  const [needsMarquee, setNeedsMarquee] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mixcloudWidget, setMixcloudWidget] = useState<any>(null);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const [volumeControlOpen, setVolumeControlOpen] = useState(false);
  const [isMarqueeing, setIsMarqueeing] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);
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
    if (!scriptLoaded) return;

    // Create iframe if it doesn't exist - we'll keep just one iframe throughout
    if (!iframeRef.current && containerRef.current) {
      console.log("Creating persistent Mixcloud iframe");

      // Create a technically visible iframe (browsers require this for audio)
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

      // Use the simplest URL format possible with full permissions
      const widgetUrl = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(showKey)}&mini=1&hide_artwork=1&autoplay=0`;

      // Only update if the URL changed to avoid unnecessary reloads
      if (iframeRef.current.src !== widgetUrl) {
        console.log("Setting widget URL:", widgetUrl);
        iframeRef.current.src = widgetUrl;
      }

      // Initialize widget when iframe loads
      iframeRef.current.onload = () => {
        if (!window.Mixcloud || !iframeRef.current) return;

        console.log("Iframe loaded, initializing widget");

        try {
          const widget = window.Mixcloud.PlayerWidget(iframeRef.current);

          widget.ready
            .then(() => {
              console.log("Mixcloud widget ready for show:", showKey);

              // Register critical events
              widget.events.play.on(() => {
                console.log("Widget event: play");
              });

              widget.events.pause.on(() => {
                console.log("Widget event: pause");
              });

              widget.events.error.on((error: any) => {
                console.error("Widget event: error", error);
              });

              // Set initial volume and store the widget
              widget
                .setVolume(volume)
                .then(() => {
                  console.log("Volume set on widget");
                  // Store widget only after volume is set successfully
                  setMixcloudWidget(widget);
                  setIsWidgetReady(true);
                })
                .catch((err) => {
                  console.error("Error setting volume:", err);
                  // Still store widget even if volume setting fails
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
    if (currentShow) {
      loadShow(currentShow.key);
      lastShowKeyRef.current = currentShow.key;
    }

    // Cleanup only when component unmounts
    return () => {
      console.log("Cleaning up Mixcloud widget on unmount");
    };
  }, [currentShow, scriptLoaded, volume]);

  // Handle playback state changes
  useEffect(() => {
    if (!mixcloudWidget || !isWidgetReady) return;

    console.log(`Handle playback change to ${isPlaying ? "playing" : "paused"}`);

    if (isPlaying) {
      // Add a slight delay to ensure browser recognizes the user interaction
      setTimeout(() => {
        // Wrap in try-catch for better error handling
        try {
          console.log("Calling play() on Mixcloud widget");
          mixcloudWidget
            .play()
            .then(() => {
              console.log("Play successful");
              // Set volume after successful play
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

  // Handle marquee animation
  useEffect(() => {
    if (!needsMarquee || !titleRef.current) return;

    let timeout: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    const startMarquee = () => {
      setIsMarqueeing(true);
      timeout = setTimeout(() => {
        setIsMarqueeing(false);
        // Wait 3 seconds before starting again
        interval = setTimeout(startMarquee, 3000);
      }, 7000); // Time it takes to scroll
    };

    startMarquee();

    return () => {
      clearTimeout(timeout);
      clearTimeout(interval);
    };
  }, [needsMarquee]);

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

  const isMobile = useIsMobile();

  // If no current show, don't render the player
  if (!currentShow) return null;

  return (
    <>
      <div ref={containerRef} className="hidden" />
      <div className="fixed top-0 bg-gray-950 text-white z-50 flex items-center transition-all duration-300 h-12 left-0 right-0 max-w-full px-4">
        <>
          <div className="flex items-center flex-1 mx-2 gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded overflow-hidden z-10 flex-shrink-0 relative">
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
            <div className="w-56 overflow-hidden">
              <div ref={titleRef} className="text-sm whitespace-nowrap">
                <Marquee>{currentShow?.name || "No show playing"}</Marquee>
              </div>
              {isLive && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-white/90 uppercase">On air</span>
                </div>
              )}
            </div>
          </div>

          <div ref={volumeControlRef} className="relative flex items-center gap-2 transition-opacity duration-200">
            {isMobile ? (
              <button className="text-white hover:bg-white/10 flex-shrink-0 p-2" onClick={toggleVolumeControl} aria-label="Volume control">
                <Volume2 className="h-5 w-5" />
              </button>
            ) : (
              <div className="text-white flex-shrink-0 p-2">
                <Volume2 className="h-5 w-5" />
              </div>
            )}

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
              className={`text-white border-t border-white/20 px-4 py-2 rounded-xs uppercase text-sm font-medium custom-play-button ${isLive ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-b from-gray-900 to-gray-700"}`}
              style={{
                boxShadow: "0px -2px 1px 0px rgba(255, 255, 255, 0.00) inset, 0px -1px 0px 0px #181B1B inset",
              }}
              onClick={togglePlayPause}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          </div>
        </>
      </div>
    </>
  );
}
