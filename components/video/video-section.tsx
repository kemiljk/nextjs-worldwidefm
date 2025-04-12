import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VideoObject } from "@/lib/cosmic-config";

interface Video extends VideoObject {}

interface VideoSectionProps {
  videos: Video[];
  className?: string;
}

function getYouTubeId(url?: string) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
}

export default function VideoSection({ videos, className }: VideoSectionProps) {
  return (
    <section className={cn("", className)}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-medium text-crimson-50">VIDEO</h2>
        <Link href="/video" className="text-sm text-crimson-50 flex items-center group">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      <div className="flex overflow-x-auto hide-scrollbar gap-6 pb-4 -mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24">
        {videos.map((video) => {
          const youtubeId = getYouTubeId(video.metadata?.video_url);
          const thumbnail = video.metadata?.image?.imgix_url || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : "/image-placeholder.svg");

          return (
            <Link key={video.id} href={`/video/${video.slug}`} className="flex-none w-2/3 lg:w-1/3">
              <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative aspect-video">
                    <Image src={thumbnail} alt={video.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent">
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-xs text-white/60 mb-2">{video.metadata?.date ? new Date(video.metadata.date).toLocaleDateString() : ""}</p>
                        <h3 className="text-lg leading-tight text-white font-display line-clamp-2">{video.title}</h3>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
