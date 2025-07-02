import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MixcloudShow } from "@/lib/mixcloud-service";
import Marquee from "@/components/ui/marquee";
import { ShowCard } from "@/components/ui/show-card";

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
      <Marquee className="-mx-4 md:-mx-8 lg:-mx-24 px-4 md:px-8 lg:px-24 h-full" speed="slow" pauseOnHover>
        <div className="grid grid-flow-col auto-cols-max h-full gap-4 grid-cols-[repeat(auto-fit,minmax(440px,1fr))]">
          {shows.map((show, index) => (
            <ShowCard key={`archive-show-${show.key}-${show.created_time}-${index}`} show={show} slug={`/episode/${show.key}`} playable />
          ))}
        </div>
      </Marquee>
    </section>
  );
}
