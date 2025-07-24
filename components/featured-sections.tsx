"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils";

interface FeaturedSectionsProps {
  shows: any[];
}

export default function FeaturedSections({ shows }: FeaturedSectionsProps) {
  // Don't render if no shows available
  if (!shows || shows.length === 0) {
    return null;
  }

  // Take the first 2 shows for featured display
  const featuredShows = shows.slice(0, 2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5">
      {featuredShows.map((show, index) => (
        <Link key={show.id || show.slug || index} href={`/episode/${show.slug}`} className="block">
          <Card className="overflow-hidden shadow-none relative cursor-pointer border border-almostblack dark:border-white hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="relative aspect-square">
                <Image src={show.pictures?.extra_large || show.enhanced_image || show.image || "/image-placeholder.svg"} alt={show.name || show.title || "Show"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority={index === 0} />
                <div className="absolute bottom-0 left-0 right-0 flex bg-linear-to-t from-almostblack to-transparent h-1/2 flex-col p-4 flex-1 justify-end">
                  <div className="bg-almostblack uppercase text-white w-fit text-h8 leading-none font-display pt-2 p-1 text-left">{show.broadcast_date ? formatDateShort(show.broadcast_date) : "RECENT SHOW"}</div>
                  <h3 className="bg-white border border-almostblack text-h8 max-w-2xl leading-none font-display text-almostblack pt-2 p-1 text-left w-fit">{show.name || show.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(show.tags || show.genres || show.enhanced_genres || []).slice(0, 3).map((tag: any, tagIndex: number) => (
                      <span key={tag.name || tag.title || tagIndex} className="text-[10px] leading-none uppercase tracking-wider px-2 py-1 rounded-full border border-white/30 text-white">
                        {tag.name || tag.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
