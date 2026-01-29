import { getEpisodesForShows } from '@/lib/episode-service';
import { ShowCard } from './ui/show-card';

interface UpcomingEpisodesProps {
  config?: {
    number_of_upcoming_shows?: number;
  };
}

export default async function UpcomingEpisodes({ config }: UpcomingEpisodesProps) {
  const limit = config?.number_of_upcoming_shows || 5;

  const response = await getEpisodesForShows({ limit, upcoming: true });
  const episodes = response.shows || [];

  if (episodes.length === 0) {
    return null;
  }

  return (
    <section className='py-8 px-5'>
      <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight uppercase'>This Week</h2>
      <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
        {episodes.map(episode => (
          <ShowCard
            key={episode.key || episode.id || episode.slug}
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
        ))}
      </div>
    </section>
  );
}
