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
}

export default function ClientSideSelectionWrapper({ featuredShows }: ClientSideSelectionWrapperProps) {
  // State for the selected show - don't set an initial value right away
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);

  // Set the initial selected show after the component mounts
  useEffect(() => {
    if (featuredShows && featuredShows.length > 0) {
      setSelectedShow(featuredShows[0]);
    }
  }, [featuredShows]);

  // If there are no featured shows or selectedShow is null, render a placeholder
  if (featuredShows.length === 0 || !selectedShow) {
    return (
      <div className="flex flex-col h-full pl-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-brand-orange">LATER</h2>
          <Link href="/archive" className="text-sm text-muted-foreground flex items-center group">
            View Archive <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <Card className="overflow-hidden border-none shadow-md flex-grow">
          <CardContent className="p-0 relative h-full flex flex-col">
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <p className="text-gray-500">No shows available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pl-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-brand-orange">LATER</h2>
        <Link href="/archive" className="text-sm text-muted-foreground flex items-center group">
          View Archive <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <Card className="overflow-hidden border-none shadow-md flex-grow">
        <CardContent className="p-0 relative h-full flex flex-col">
          <Image src={selectedShow.image || "/placeholder.svg"} alt={selectedShow.title || "Selected Show"} width={500} height={400} className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
            <div className="flex justify-between items-end">
              <p className="text-sm max-w-[70%]">{selectedShow.description || ""}</p>
              <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white rounded-md px-4 py-2 text-sm flex items-center gap-2">
                <Play className="h-4 w-4 fill-current" /> Listen
              </Button>
            </div>
          </div>
          {featuredShows.length > 1 && (
            <>
              <div className="absolute top-1/2 left-4 transform -translate-y-1/2">
                <Button
                  variant="outline"
                  className="bg-white/20 backdrop-blur-sm text-white rounded-full p-2 hover:bg-white/30"
                  onClick={() => {
                    const currentIndex = featuredShows.findIndex((show) => show.id === selectedShow.id);
                    const prevIndex = (currentIndex - 1 + featuredShows.length) % featuredShows.length;
                    setSelectedShow(featuredShows[prevIndex]);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
                <Button
                  variant="outline"
                  className="bg-white/20 backdrop-blur-sm text-white rounded-full p-2 hover:bg-white/30"
                  onClick={() => {
                    const currentIndex = featuredShows.findIndex((show) => show.id === selectedShow.id);
                    const nextIndex = (currentIndex + 1) % featuredShows.length;
                    setSelectedShow(featuredShows[nextIndex]);
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
            <button key={index} className={`${selectedShow.id === show.id ? "border-2 border-dotted border-brand-orange" : ""} rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-orange`} onClick={() => setSelectedShow(show)}>
              <Image src={show.thumbnail || "/placeholder.svg"} alt={show.title} width={100} height={100} className="w-full aspect-square object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
