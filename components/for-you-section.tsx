import { getEpisodesForShows } from '@/lib/episode-service';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { ShowCard } from './ui/show-card';

interface ForYouSectionProps {
  favoriteGenreIds: string[];
  favoriteHostIds: string[];
  limit?: number;
  title?: string;
}

export async function ForYouSection({
  favoriteGenreIds,
  favoriteHostIds,
  limit = 12,
  title = 'FOR YOU',
}: ForYouSectionProps) {
  const episodes: any[] = [];

  try {
    // Limit to top 3 favorites to avoid too many API calls
    const limitedGenres = favoriteGenreIds.slice(0, 3);
    const limitedHosts = favoriteHostIds.slice(0, 3);

    // Reduce per-request limit to avoid large queries
    const perRequestLimit = Math.max(limit + 5, 15);

    const promises: Promise<any>[] = [];

    if (limitedGenres.length > 0) {
      promises.push(
        getEpisodesForShows({
          genre: limitedGenres,
          limit: perRequestLimit,
          offset: 0,
        })
      );
    }

    if (limitedHosts.length > 0) {
      promises.push(
        getEpisodesForShows({
          host: limitedHosts,
          limit: perRequestLimit,
          offset: 0,
        })
      );
    }

    // Fetch with timeout protection
    const results = await Promise.allSettled(
      promises.map(async p => {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 8000);
        });
        return Promise.race([p, timeoutPromise]);
      })
    );

    // Extract successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.shows) {
        episodes.push(...result.value.shows);
      }
    }

    const uniqueEpisodes = new Map();
    for (const episode of episodes) {
      const key = episode.id || episode.slug;
      if (!uniqueEpisodes.has(key)) {
        uniqueEpisodes.set(key, episode);
      }
    }

    const sortedEpisodes = Array.from(uniqueEpisodes.values())
      .sort((a, b) => {
        const dateA = new Date(a.metadata?.broadcast_date || a.created_at || 0);
        const dateB = new Date(b.metadata?.broadcast_date || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, limit);

    if (sortedEpisodes.length === 0) {
      return null;
    }

    return (
      <section className={title ? 'py-8 px-5' : 'py-0 px-0'}>
        {title && <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight'>{title}</h2>}
        <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
          {sortedEpisodes.map(episode => {
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
      </section>
    );
  } catch (error) {
    console.error('Error fetching For You shows:', error);
    // Silently fail - don't show the section if there's an error
    return null;
  }
}
