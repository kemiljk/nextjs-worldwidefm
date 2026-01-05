import Link from 'next/link';
import { connection } from 'next/server';
import { getEpisodeBySlug, getRelatedEpisodes } from '@/lib/episode-service';
import { addMinutes } from 'date-fns';
import { displayNameToSlug } from '@/lib/host-matcher';
import { ShowCard } from '@/components/ui/show-card';
import { EpisodeHero } from '@/components/homepage-hero';
import { SafeHtml } from '@/components/ui/safe-html';
import { GenreTag } from '@/components/ui/genre-tag';
import { TracklistToggle } from '@/components/ui/tracklisttoggle';
import { parseBroadcastDateTime } from '@/lib/date-utils';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import { PreviewBanner } from '@/components/ui/preview-banner';
import { ListenBackButton } from '@/components/listen-back-button';

function HostLink({ host, className }: { host: any; className: string }) {
  // Handle case where host might be just an ID string instead of an object
  if (!host || typeof host === 'string') {
    return null;
  }

  const displayName = host.title || host.name;
  if (!displayName) {
    return null;
  }

  let href: string;
  if (host.slug) {
    href = `/hosts/${host.slug}`;
  } else {
    const fallbackSlug = displayNameToSlug(displayName);
    href = `/hosts/${fallbackSlug}`;
  }

  return (
    <Link href={href} className={className}>
      {displayName}
    </Link>
  );
}

export default async function EpisodePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  // Opt into dynamic rendering - ensures Cosmic changes show instantly
  await connection();

  const { slug: showSlug } = await params;
  const { preview } = await (searchParams || Promise.resolve({ preview: undefined }));

  // First try to get episode from Cosmic
  const episode = await getEpisodeBySlug(showSlug, preview);

  if (!episode) {
    return (
      <div className='flex flex-col items-center justify-center min-h-dvh text-center'>
        <h1 className='text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-4'>
          Episode Not Found
        </h1>
        <p className='text-lg text-muted-foreground mb-6'>
          Sorry, we couldn't find an episode for this link. It may have been removed or does not
          exist.
        </p>
        <Link href='/shows' className='text-blue-600 hover:underline'>
          Back to Shows
        </Link>
      </div>
    );
  }

  // Transform the episode data to the expected format
  const show = transformShowToViewData(episode);

  const startTime =
    parseBroadcastDateTime(episode.metadata.broadcast_date, episode.metadata.broadcast_time) ||
    new Date(episode.created_at);

  // Get related episodes based on genres and hosts
  const relatedEpisodesRaw = await getRelatedEpisodes(episode.id, 3);
  const relatedEpisodes = relatedEpisodesRaw.map(ep => transformShowToViewData(ep));

  // Get canonical genres for genre tag linking
  const canonicalGenres = await getCanonicalGenres();

  // Helper function to get genre link
  const getGenreLink = (genreId: string): string | undefined => {
    if (!canonicalGenres.length) return undefined;
    const canonicalGenre = canonicalGenres.find(genre => genre.id === genreId);
    return canonicalGenre ? `/genre/${canonicalGenre.slug}` : undefined;
  };

  const displayName = episode.title || 'Untitled Episode';
  const baseImageUrl = episode.metadata.image?.imgix_url;
  const displayImage = baseImageUrl 
    ? `${baseImageUrl}?w=1200&auto=format,compress`
    : '/image-placeholder.png';

  // Check if this is a draft episode
  const isDraft = episode.status === 'draft';

  // Format date for overlay (e.g., SAT 14.06.25)
  const year = startTime.getFullYear();
  const yearSuffix = `.${year.toString().slice(-2)}`;
  const showDate = startTime
    .toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
    .replace(/\//g, '.')
    .concat(yearSuffix)
    .toUpperCase();

  return (
    <div className='pb-50'>
      {/* Preview Banner - show when episode is a draft */}
      {isDraft && <PreviewBanner />}

      <EpisodeHero
        displayName={displayName}
        displayImage={displayImage}
        showDate={showDate}
        show={show}
      />

      {/* Listen Back Button - positioned underneath the show title */}
      {show?.metadata?.player && (
        <div className='px-5 pt-4'>
          <ListenBackButton show={show} />
        </div>
      )}

      {/* Main Content Container */}

      <div className='w-full flex flex-col md:flex-row justify-between gap-8 px-5 pt-8'>
        {/*LEFT CONTAINER*/}
        <div className='w-full md:w-[40%] lg:w-[35%] flex flex-col gap-3'>
          {/* Episode Description */}
          {(episode.metadata.body_text || episode.metadata.description) && (
            <div className='max-w-none'>
              <SafeHtml
                content={episode.metadata.body_text || episode.metadata.description || ''}
                type='editorial'
                className='text-m6 leading-5 text-almostblack dark:text-white'
              />
            </div>
          )}

          {/* Genres Section */}
          {episode.metadata.genres?.length > 0 && (
            <div>
              <div className='flex flex-wrap my-3'>
                {episode.metadata.genres.map((genre: any) => {
                  const genreLink = genre.id ? getGenreLink(genre.id) : undefined;
                  return (
                    <GenreTag key={genre.id || genre.slug} variant='large' href={genreLink}>
                      {genre.title || genre.name}
                    </GenreTag>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hosts, Duration, and Broadcast Info Row */}
          {(episode.metadata.regular_hosts?.length > 0 ||
            episode.metadata.duration ||
            episode.metadata.broadcast_date ||
            episode.metadata.broadcast_date_old) && (
            <div className='flex flex-row flex-wrap items-center gap-2'>
              {/* Hosts */}
              {episode.metadata.regular_hosts?.length > 0 && (
                <>
                  <div className='flex flex-row flex-wrap items-center gap-1'>
                    {episode.metadata.regular_hosts.map((host: any) => (
                      <HostLink
                        key={host.id || host.slug}
                        host={host}
                        className='text-m8 font-mono uppercase text-muted-foreground hover:text-foreground transition-colors'
                      />
                    ))}
                  </div>
                  {(episode.metadata.duration ||
                    episode.metadata.broadcast_date ||
                    episode.metadata.broadcast_date_old) && (
                    <span className='text-muted-foreground text-m8'>|</span>
                  )}
                </>
              )}

              {/* Duration */}
              {episode.metadata.duration && (
                <>
                  <span className='text-m8 font-mono uppercase text-muted-foreground'>
                    {episode.metadata.duration}
                  </span>
                  {(episode.metadata.broadcast_date || episode.metadata.broadcast_date_old) && (
                    <span className='text-muted-foreground text-m8'>|</span>
                  )}
                </>
              )}

              {/* Broadcast Info */}
              {(episode.metadata.broadcast_date || episode.metadata.broadcast_date_old) && (
                <span className='text-m8 font-mono uppercase text-muted-foreground'>
                  {parseBroadcastDateTime(
                    episode.metadata.broadcast_date,
                    episode.metadata.broadcast_time,
                    episode.metadata.broadcast_date_old
                  )?.toLocaleDateString()}
                  {episode.metadata.broadcast_time && ` | ${episode.metadata.broadcast_time}`}
                </span>
              )}
            </div>
          )}

          {/* Tracklist Section */}
          {(() => {
            if (
              (!episode.metadata.broadcast_date && !episode.metadata.broadcast_date_old) ||
              !episode.metadata.tracklist
            )
              return null;

            const durationInMinutes = episode.metadata.duration
              ? parseInt(episode.metadata.duration.split(':')[0])
              : 120;

            const broadcastStart =
              parseBroadcastDateTime(
                episode.metadata.broadcast_date,
                episode.metadata.broadcast_time,
                episode.metadata.broadcast_date_old
              ) || new Date();
            const broadcastEnd = addMinutes(broadcastStart, durationInMinutes);
            const now = new Date();
            const showTracklist = now >= broadcastEnd;

            return (
              showTracklist && (
                <div className='my-4'>
                  <TracklistToggle tracklist={episode.metadata.tracklist} />
                </div>
              )
            );
          })()}
        </div>

        {/*RIGHT CONTAINER*/}
        <div className='w-full md:w-[50%] flex flex-col gap-2 h-auto'>
          {relatedEpisodes.length > 0 && (
            <div>
              <h2 className='text-h8 md:text-h7 font-bold tracking-tight leading-none'>
                RELATED EPISODES
              </h2>
              <div className='grid grid-cols-2 lg:grid-cols-3 gap-3 justify-between pt-3'>
                {relatedEpisodes.map(relatedEpisode => {
                  const slug = `/episode/${relatedEpisode.slug}`;
                  return (
                    <ShowCard
                      key={relatedEpisode.id || relatedEpisode.slug}
                      show={relatedEpisode}
                      slug={slug}
                      playable
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
