'use client';

import { useEffect, useState } from 'react';
import { ShowCard } from '@/components/ui/show-card';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Bookmark } from 'lucide-react';
import { SaveShowButton } from '@/components/save-show-button';

interface ListenLaterClientProps {
  listenLaterIds: string[];
}

export function ListenLaterClient({ listenLaterIds }: ListenLaterClientProps) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listenLaterIds || listenLaterIds.length === 0) {
      setEpisodes([]);
      setLoading(false);
      return;
    }

    const fetchEpisodes = async () => {
      try {
        setLoading(true);
        setError(null);

        // We can create a new API route or use a generic one.
        // For now, let's assume we can fetch by IDs.
        const response = await fetch('/api/episodes/by-ids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: listenLaterIds }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch listen later shows');
        }

        const data = await response.json();
        setEpisodes(data.episodes || []);
      } catch (err) {
        console.error('Error fetching listen later episodes:', err);
        setError('Unable to load queue');
      } finally {
        setLoading(false);
      }
    };

    fetchEpisodes();
  }, [listenLaterIds]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full">
        {Array.from({ length: Math.min(listenLaterIds.length, 5) }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-gray-200 dark:bg-gray-800 border border-almostblack dark:border-white" />
            <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-800 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No Saved Shows"
        description="Save episodes to 'Listen Later' while browsing and they'll appear here."
      />
    );
  }

  const removeEpisode = (episodeId: string) => {
    setEpisodes((prev) => prev.filter((ep) => (ep.id || ep._id) !== episodeId));
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full h-auto">
      {episodes.map((episode) => {
        const transformed = transformShowToViewData(episode);
        const episodeId = episode.id || episode._id;
        return (
          <div key={episodeId || episode.slug} className="relative group">
            <ShowCard
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
              isSaved={false} // Disable standard bookmark to use our interactive one
            />
            <SaveShowButton
              show={{ id: episodeId, slug: episode.slug, title: episode.title }}
              isSaved={true}
              iconOnly
              className="absolute top-4 right-4"
              onBeforeClick={(saved) => {
                if (saved) removeEpisode(episodeId);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
