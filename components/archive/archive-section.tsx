import { ShowCard } from "@/components/ui/show-card";
import { FeaturedCard } from "../featured-card";

interface ArchiveSectionProps {
  shows: any[]; // Using any for show format compatibility
  className?: string;
}

export default function ArchiveSection({ shows, className }: ArchiveSectionProps) {
  const firstShow = shows[0];            // index 0
  const nextTwoShows = shows.slice(1, 3); // indexes 1, 2, 3
  return (
    <section className=" w-full relative flex flex-col gap-6 h-auto p-5">
      <div className="">
        <div className="w-full flex flex-row justify-between items-end pb-4 ">
          <h2 className="text-h8 md:text-h7 font-bold tracking-tight">FROM THE ARCHIVE</h2>
          <a
            href="/shows"
            className='font-mono text-m8 sm:text-m7 text-almostblack uppercase hover:underline transition-all'
          >
            SEE ALL &gt;
          </a>
        </div>

        <div className="flex sm:flex-row w-full h-[80vh] gap-3 flex-col">
          {/* First show in its own container */}
          {firstShow && (
            <div className="flex h-[60%] sm:h-full w-full sm:w-[70%]">
              <FeaturedCard show={firstShow} slug={`/episode${firstShow.key}`} playable className="w-full h-full" />
            </div>
          )}

          {/* Next two shows in a separate column */}
          {nextTwoShows.length > 0 && (
            <div className="flex flex-row w-full sm:flex-col gap-3 sm:w-[30%] sm:h-full h-[40%] column-layout">
              {nextTwoShows.map((show, index) => (
                <ShowCard
                  key={`archive-show-${show.key}-${show.created_time}-${index}`}
                  show={show}
                  slug={`/episode${show.key}`}
                  playable
                  className="w-full flex-1" // <-- stretch to fill evenly
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
