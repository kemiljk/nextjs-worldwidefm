import { getEpisodesForShows } from '@/lib/episode-service';
import { ShowCard } from './ui/show-card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface UpcomingEpisodesProps {
  config?: {
    number_of_upcoming_shows?: number;
  };
}

export default async function UpcomingEpisodes({ config }: UpcomingEpisodesProps) {
  const limit = config?.number_of_upcoming_shows || 14;

  const response = await getEpisodesForShows({ limit, upcoming: true });
  const episodes = response.shows || [];

  if (episodes.length === 0) {
    return null;
  }

  return (
    <section className='py-8 px-5'>
      <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight uppercase'>This Week</h2>
      <div className='relative w-full'>
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className='w-full'
        >
          <CarouselContent className='-ml-3'>
            {episodes.map(episode => (
              <CarouselItem
                key={episode.key || episode.id || episode.slug}
                className='pl-3 basis-4/5 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5'
              >
                <ShowCard
                  show={{
                    ...episode,
                    url: episode.metadata?.player
                      ? episode.metadata.player.startsWith('http')
                        ? episode.metadata.player
                        : `https://www.mixcloud.com${episode.metadata.player}`
                      : episode.url || '',
                    key: episode.slug,
                  }}
                  slug={`/episode/${episode.slug}`}
                  playable={false}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {episodes.length > 5 && (
            <>
              <CarouselPrevious className='hidden md:flex -left-4 bg-white dark:bg-almostblack border-almostblack dark:border-white' />
              <CarouselNext className='hidden md:flex -right-4 bg-white dark:bg-almostblack border-almostblack dark:border-white' />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}
