"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VideoObject } from "@/lib/cosmic-config";
import Marquee from "@/components/ui/marquee";

interface Video extends VideoObject {}

interface VideoSectionProps {
  videos: Video[];
  className?: string;
}

// Helper function to extract YouTube video ID from URL
function getYouTubeThumbnail(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[2].length === 11) {
    return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`;
  }

  return null;
}

// Helper function to extract Vimeo video ID from URL
function getVimeoThumbnail(url: string) {
  const regExp = /vimeo\.com\/(\d+)/;
  const match = url.match(regExp);

  if (match) {
    return `https://vumbnail.com/${match[1]}.jpg`;
  }

  return null;
}

export default function VideoSection({ videos, className }: VideoSectionProps) {
  return (
    <section className={cn("", className)}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">VIDEO</h2>
        <Link href="/videos" className="text-sm text-crimson-50 flex items-center group">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24" speed="slow" pauseOnHover>
        {videos.map((video) => {
          const youtubeId = video.metadata?.video_url ? getYouTubeThumbnail(video.metadata.video_url) : "";
          const vimeoId = video.metadata?.video_url ? getVimeoThumbnail(video.metadata.video_url) : "";
          const thumbnailUrl = video.metadata?.image?.imgix_url || youtubeId || vimeoId || "/image-placeholder.svg";

          return (
            <Link key={video.id} href={`/videos/${video.slug}`} className="flex-none w-[440px]">
              <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative aspect-video">
                    <Image src={thumbnailUrl} alt={video.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-transparent">
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-xs text-white/60 mb-2">{video.metadata?.date ? new Date(video.metadata.date).toLocaleDateString() : ""}</p>
                        <h3 className="text-m5 font-mono font-normal text-white line-clamp-2">{video.title}</h3>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </Marquee>
    </section>
  );
}
