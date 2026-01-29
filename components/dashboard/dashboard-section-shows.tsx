'use client';

import { useEffect, useState } from 'react';
import { ShowCard } from '@/components/ui/show-card';
import { transformShowToViewData } from '@/lib/cosmic-service';

interface DashboardSectionShowsProps {
  genreId?: string;
  hostId?: string;
  limit?: number;
  title: string;
}

export function DashboardSectionShows({
  genreId,
  hostId,
  limit = 4,
  title,
}: DashboardSectionShowsProps) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (genreId) params.set('genres', genreId);
        if (hostId) params.set('hosts', hostId);
        params.set('limit', String(limit));

        const response = await fetch(`/api/for-you?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch shows');
        }

        const data = await response.json();
        setEpisodes(data.episodes || []);
      } catch (err) {
        console.error(`Error fetching shows for ${title}:`, err);
        setError('Unable to load shows');
      } finally {
        setLoading(false);
      }
    };

    fetchEpisodes();
  }, [genreId, hostId, limit, title]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold uppercase font-mono">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-gray-200 dark:bg-gray-800 border border-almostblack dark:border-white" />
              <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-800 w-3/4" />
              <div className="mt-1 h-3 bg-gray-200 dark:bg-gray-800 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || episodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold uppercase font-mono">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full h-auto">
        {episodes.map((episode) => {
          const transformed = transformShowToViewData(episode);
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
    </div>
  );
}
