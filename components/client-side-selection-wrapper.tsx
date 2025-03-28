"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Define the interface for show data coming from the parent
interface Show {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  thumbnail: string;
  slug: string;
}

// Props for the component
interface ClientSideSelectionWrapperProps {
  featuredShows: Show[];
  title?: string;
}

export default function ClientSideSelectionWrapper({ featuredShows, title = "COMING UP" }: ClientSideSelectionWrapperProps) {
  // State for the selected show and its index
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Set the initial selected show after the component mounts
  useEffect(() => {
    if (featuredShows && featuredShows.length > 0) {
      setSelectedShow(featuredShows[0]);
      setSelectedIndex(0);
    }
  }, [featuredShows]);

  // Handle show selection
  const handleSelectShow = (show: Show, index: number) => {
    setSelectedShow(show);
    setSelectedIndex(index);
  };

  // If there are no featured shows or selectedShow is null, render a placeholder
  if (featuredShows.length === 0 || !selectedShow) {
    return (
      <div className="flex flex-col h-full p-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium text-crimson-500">{title}</h2>
          <Link href="/archive" className="text-sm text-muted-foreground flex items-center group">
            View Archive <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <Card className="overflow-hidden border-none shadow-none">
          <CardContent className="p-0 relative h-full flex flex-col">
            <div className="aspect-square rounded w-full bg-gray-100 flex items-center justify-center">
              <p className="text-gray-500">No shows available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-crimson-500">{title}</h2>
        <Link href="/archive" className="text-sm text-muted-foreground flex items-center group">
          View Archive <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <Card className="overflow-hidden border-none shadow-md flex-grow">
        <CardContent className="p-0 relative h-full flex flex-col">
          <div className="aspect-square w-full relative">
            <Image src={selectedShow.image || "/placeholder.svg"} alt={selectedShow.title || "Selected Show"} fill className="object-cover" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-2xl p-4 text-white">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-tight  font-medium">{selectedShow.title || "Untitled Show"}</h3>
                </div>
                <p className="text-sm max-w-[70%]">{selectedShow.description || ""}</p>
                <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white px-4 py-2 text-sm flex items-center gap-2">
                  <Play className="h-4 w-4 fill-current" /> Listen
                </Button>
              </div>
            </div>
          </div>
          {featuredShows.length > 1 && (
            <>
              <div className="absolute top-1/2 left-4 transform -translate-y-1/2">
                <Button
                  variant="ghost"
                  className="bg-white/40 size-8 backdrop-blur-sm text-black rounded-full p-2 hover:bg-white/50"
                  onClick={() => {
                    const prevIndex = (selectedIndex - 1 + featuredShows.length) % featuredShows.length;
                    handleSelectShow(featuredShows[prevIndex], prevIndex);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
                <Button
                  variant="ghost"
                  className="bg-white/40 size-8 backdrop-blur-sm text-black rounded-full p-2 hover:bg-white/50"
                  onClick={() => {
                    const nextIndex = (selectedIndex + 1) % featuredShows.length;
                    handleSelectShow(featuredShows[nextIndex], nextIndex);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Thumbnail grid */}
      {featuredShows.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mt-6">
          {featuredShows.map((show, index) => (
            <button key={index} onClick={() => handleSelectShow(show, index)} className={`relative rounded-none overflow-hidden focus:outline-none ${index === selectedIndex ? "border-2 border-brand-orange" : "border-2 border-transparent"}`}>
              <div className="aspect-square relative">
                <Image src={show.thumbnail || "/placeholder.svg"} alt={show.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                  <h4 className="text-xs font-medium line-clamp-1">{show.title || "Untitled Show"}</h4>
                  <p className="text-[10px] text-bronze-100 line-clamp-1">{show.subtitle || ""}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
