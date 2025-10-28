'use client';

import { useState, useEffect } from 'react';
import { getEpisodesForShows } from '@/lib/episode-service';
import { ShowCard } from './ui/show-card';

interface LatestEpisodesProps {
  config?: {
    number_of_latest_shows?: number;
  };
}

const LatestEpisodes: React.FC<LatestEpisodesProps> = ({ config }) => {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = config?.number_of_latest_shows || 5;

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        setLoading(true);
        const response = await getEpisodesForShows({ limit, offset: 2 });
        setEpisodes(response.shows || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch episodes');
        console.error('Error fetching latest episodes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEpisodes();
  }, [limit]);

  if (error) {
    return;
  }

  if (episodes.length === 0) {
    return;
  }

  return (
    <section className='py-8 px-5'>
      <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight'>LATEST SHOWS</h2>
      <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto '>
        {episodes.map(episode => (
          <ShowCard
            key={episode.key || episode.id || episode.slug}
            show={{
              ...episode,
              // Add Mixcloud player URL for episodes
              url: episode.metadata?.player
                ? episode.metadata.player.startsWith('http')
                  ? episode.metadata.player
                  : `https://www.mixcloud.com${episode.metadata.player}`
                : episode.url || '',
              // Add key for ShowCard (used for show identification in media player)
              key: episode.slug,
            }}
            slug={`/episode/${episode.slug}`}
            playable
          />
        ))}
      </div>
    </section>
  );
};

export default LatestEpisodes;
