"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Show {
  id?: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  thumbnail?: string;
  slug?: string;
}

interface MediaPlayerProps {
  currentShow: Show | null;
}

export default function MediaPlayer({ currentShow }: MediaPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsMarquee, setNeedsMarquee] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  // Check if title needs marquee effect (if it's too long for container)
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
      }, 300); // Match the duration in the transition-all class
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  const toggleExpanded = () => {
    setIsTransitioning(true);
    setIsExpanded(!isExpanded);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={`fixed bottom-0 left-0 ${isExpanded ? "max-w-full" : "max-w-[6.7rem]"} w-full bg-green-500 dark:bg-green-700 text-white rounded-none border-t border-green-900 z-50 flex items-center px-4 py-3 transition-all duration-300`}>
      <Button variant="ghost" className="text-white hover:bg-white/10 p-2 mr-2 flex-shrink-0" onClick={toggleExpanded}>
        {isExpanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </Button>

      {isExpanded ? (
        <>
          <div className="flex items-center flex-1 mx-2 overflow-hidden">
            <div className="w-10 h-10 rounded overflow-hidden mr-3 flex-shrink-0 relative">
              <Image src={currentShow?.thumbnail || "/image-placeholder.svg?w=40&h=40"} alt={currentShow?.title || "Now playing"} fill className="object-cover" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div ref={titleRef} className={`font-medium whitespace-nowrap ${isPlaying && needsMarquee ? "animate-marquee" : "truncate"}`}>
                {currentShow?.title || "No show playing"}
              </div>
            </div>
          </div>

          {/* Only show these controls when not transitioning */}
          <div className={`transition-opacity duration-200 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
            <Button variant="ghost" className="text-white mr-2 hover:bg-white/10 flex-shrink-0">
              <Volume2 className="h-5 w-5" />
            </Button>
          </div>

          <div className={`border-l border-white/20 pl-2 flex items-center gap-2 flex-shrink-0 transition-opacity duration-200 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
            <button
              className="text-white border-t border-white px-4 py-2 rounded-xs uppercase text-sm font-medium custom-play-button bg-gradient-to-b from-gray-900 to-gray-700"
              style={{
                boxShadow: "0px -2px 1px 0px rgba(255, 255, 255, 0.00) inset, 0px -1px 0px 0px #181B1B inset",
              }}
              onClick={togglePlayPause}
            >
              {isPlaying ? "STOP" : "PLAY"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center">
          <div className="w-10 h-10 rounded overflow-hidden relative">
            <Image src={currentShow?.thumbnail || "/image-placeholder.svg?w=40&h=40"} alt={currentShow?.title || "Now playing"} fill className="object-cover" />
            <button onClick={togglePlayPause} className="absolute inset-0 bg-black/30 flex items-center justify-center hover:bg-black/40 transition-colors">
              {isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
