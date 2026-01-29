'use client';

import { useEffect, useState } from 'react';
import { ShowCard } from '@/components/ui/show-card';
import { transformShowToViewData } from '@/lib/cosmic-service';

interface ForYouClientProps {
  favoriteGenreIds: string[];
  favoriteHostIds: string[];
  limit?: number;
  title?: string;
}

interface Episode {
  id: string;
  slug: string;
  title?: string;
  metadata?: {
    broadcast_date?: string;
    player?: string;
    image?: { imgix_url?: string };
    external_image_url?: string;
    genres?: any[];
    regular_hosts?: any[];
  };
  created_at?: string;
}

export function ForYouClient({
  favoriteGenreIds,
  favoriteHostIds,
  limit = 12,
  title = 'FOR YOU',
}: ForYouClientProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if no favorites
    if (favoriteGenreIds.length === 0 && favoriteHostIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchEpisodes = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch episodes via API route
        const params = new URLSearchParams();
        if (favoriteGenreIds.length > 0) {
          params.set('genres', favoriteGenreIds.slice(0, 3).join(','));
        }
        if (favoriteHostIds.length > 0) {
          params.set('hosts', favoriteHostIds.slice(0, 3).join(','));
        }
        params.set('limit', String(limit));

        const response = await fetch(`/api/for-you?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch recommendations');
        }

        const data = await response.json();
        setEpisodes(data.episodes || []);
      } catch (err) {
        console.error('Error fetching For You episodes:', err);
        setError('Unable to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchEpisodes();
  }, [favoriteGenreIds, favoriteHostIds, limit]);

  // Loading skeleton
  if (loading) {
    return (
      <section className={title ? 'py-8 px-5' : 'py-0 px-0'}>
        {title && <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight'>{title}</h2>}
        <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full'>
          {Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
            <div key={i} className='animate-pulse'>
              <div className='aspect-square bg-gray-200 dark:bg-gray-800 rounded-none' />
              <div className='mt-2 h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4' />
              <div className='mt-1 h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2' />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // No episodes or error
  if (error || episodes.length === 0) {
    return null; // Silently fail
  }

  return (
    <section className={title ? 'py-8 px-5' : 'py-0 px-0'}>
      {title && <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight'>{title}</h2>}
      <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
        {episodes.map(episode => {
          const transformed = transformShowToViewData(episode as any);
          return (
            <ShowCard
              key={episode.id || episode.slug}
              show={{
                ...transformed,
                url: episode.metadata?.player
                  ? episode.metadata.player.startsWith('http')
                    ? episode.metadata.player
                    : `https://www.mixcloud.com${episode.metadata.player}`
                  : '',
                key: episode.slug,
              }}
              slug={`/episode/${episode.slug}`}
              playable
            />
          );
        })}
      </div>
    </section>
  );
}
