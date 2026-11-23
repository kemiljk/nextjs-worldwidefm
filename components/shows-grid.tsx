import { ShowCard } from './ui/show-card';
import type { CanonicalGenre } from '@/lib/get-canonical-genres';

interface ShowsGridProps {
  shows: any[];
  contentType?: 'episodes' | 'hosts-series' | 'takeovers';
  canonicalGenres?: CanonicalGenre[];
}

export function ShowsGrid({
  shows,
  contentType = 'episodes',
  canonicalGenres = [],
}: ShowsGridProps) {
  if (shows.length === 0) {
    return (
      <div className='text-center py-8'>
        <p className='font-mono text-almostblack text-m8 uppercase'>Fetching shows...</p>
      </div>
    );
  }

  const getSlugForShow = (show: any) => {
    const source = show.__source || contentType;

    switch (source) {
      case 'host':
      case 'hosts-series':
        return `/hosts/${show.slug}`;
      case 'takeover':
      case 'takeovers':
        return `/takeovers/${show.slug}`;
      case 'episode':
      case 'episodes':
      default:
        return `/episode/${show.slug}`;
    }
  };

  return (
    <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
      {shows.filter(Boolean).map((show: any, index: number) => {
        const uniqueKey = `${show.id || show.slug}-${index}`;
        const slug = getSlugForShow(show);
        return (
          <ShowCard
            className='w-full'
            priority={index < 4}
            key={uniqueKey}
            show={show}
            slug={slug}
            canonicalGenres={canonicalGenres}
          />
        );
      })}
    </div>
  );
}
