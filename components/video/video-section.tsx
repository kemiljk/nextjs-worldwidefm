import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { VideoObject } from "@/lib/cosmic-config";
import VideoGrid from "./video-grid";
import { cn } from "@/lib/utils";

interface VideoSectionProps {
  title?: string;
  videos: VideoObject[];
  className?: string;
}

export default function VideoSection({ title = "VIDEOS", videos, className = "mb-12 z-10" }: VideoSectionProps) {
  return (
    <section className={cn("", className)}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-medium text-crimson-50">{title}</h2>
        <Link href="/videos" className="text-sm text-crimson-50 flex items-center group hover:text-crimson-50/80 transition-colors">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <VideoGrid videos={videos} />
    </section>
  );
}
