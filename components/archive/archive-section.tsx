import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { MixcloudShow, filterWorldwideFMTags } from "@/lib/mixcloud-service";
import Marquee from "@/components/ui/marquee";
import { formatDateShort } from "@/lib/utils";

interface ArchiveSectionProps {
  shows: MixcloudShow[];
  className?: string;
}

export default function ArchiveSection({ shows, className }: ArchiveSectionProps) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-h7 font-display uppercase font-normal text-almostblack">FROM THE ARCHIVE</h2>
        <Link href="/shows" className="text-sm text-green-50 flex items-center group">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24" speed="slow" pauseOnHover>
        {shows.map((show, index) => {
          // Convert key to path segments
          const segments = show.key.split("/").filter(Boolean);
          let showPath = segments.join("/");
          if (showPath.startsWith("worldwidefm/")) {
            showPath = showPath.replace(/^worldwidefm\//, "");
          }

          return (
            <Link key={`archive-show-${show.key}-${show.created_time}-${index}`} href={`/episode/${showPath}`} className="flex-none w-[300px]">
              <Card className="overflow-hidden border-none hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative aspect-square">
                    <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent">
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-xs text-white/60 mb-2">{formatDateShort(show.created_time)}</p>
                        {show.tags && show.tags.length > 0 && (
                          <div className="flex truncate gap-1 mb-2">
                            {filterWorldwideFMTags(show.tags).map((tag, tagIndex) => (
                              <span key={`archive-tag-${show.key}-${show.created_time}-${tag.key}-${tag.url}-${tagIndex}`} className="px-2 py-1 border border-white/50 rounded-full text-[9.5px] transition-colors uppercase text-white bg-black/50">
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <h3 className="text-m5 font-mono font-normal text-white line-clamp-2">{show.name}</h3>
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
