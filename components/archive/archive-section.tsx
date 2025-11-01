import { ShowCard } from '@/components/ui/show-card';
import { FeaturedCard } from '../featured-card';

interface ArchiveSectionProps {
  shows: any[]; // Using any for show format compatibility
  className?: string;
}

export default function ArchiveSection({ shows, className }: ArchiveSectionProps) {
  const firstShow = shows[0]; // index 0
  const nextFourShows = shows.slice(1, 5); // indexes 1, 2, 3
  return (
    <section className=' w-full relative flex flex-col gap-6 h-auto p-5'>
      <div className=''>
        <div className='w-full flex flex-row justify-between items-end pb-4 '>
          <h2 className='text-h8 md:text-h7 font-bold tracking-tight'>FROM THE ARCHIVE</h2>
          <a
            href='/shows'
            className='font-mono text-m8 sm:text-m7 text-almostblack uppercase hover:underline transition-all'
          >
            SEE ALL &gt;
          </a>
        </div>

        <div className='flex md:flex-row w-full gap-3 flex-col md:items-stretch'>
          {/* First show in its own container */}
          {firstShow && (
            <div className='flex w-full h-100 md:h-auto md:w-[60%]'>
              <FeaturedCard
                show={firstShow}
                slug={`/episode/${firstShow.key}`}
                playable
                className='w-full h-full'
              />
            </div>
          )}
          {/* four shows in a separate grid */}
          {nextFourShows.length > 0 && (
            <div className='flex flex-row md:grid md:grid-cols-2 gap-3 w-full md:w-[40%]'>
              {nextFourShows.map((show, index) => (
                <ShowCard
                  key={`archive-show-${show.key}-${show.created_time}-${index}`}
                  show={show}
                  slug={`/episode/${show.key}`}
                  playable
                  className={`w-[calc(50%-0.375rem)] md:w-full h-auto ${index >= 2 ? 'hidden md:block' : ''}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
