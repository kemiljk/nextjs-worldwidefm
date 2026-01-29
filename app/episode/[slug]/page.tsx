import React from 'react';
import Link from 'next/link';
import { getEpisodeBySlug, getRelatedEpisodes } from '@/lib/episode-service';
import { getRecentEpisodeSlugs } from '@/lib/episode-service.server';
import { addMinutes } from 'date-fns';
import { displayNameToSlug } from '@/lib/host-matcher';
import { ShowCard } from '@/components/ui/show-card';
import { EpisodeHero } from '@/components/homepage-hero';
import { SafeHtml } from '@/components/ui/safe-html';
import { GenreTag } from '@/components/ui/genre-tag';
import { TracklistToggle } from '@/components/ui/tracklisttoggle';
import { parseBroadcastDateTime, parseDurationToMinutes } from '@/lib/date-utils';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import { PreviewBanner } from '@/components/ui/preview-banner';
import { ListenBackButton } from '@/components/listen-back-button';
import { getEpisodeImageUrl } from '@/lib/cosmic-types';
import { getAuthUser, getUserData } from '@/cosmic/blocks/user-management/actions';
import { SaveShowButton } from '@/components/save-show-button';
import { FavoriteButton } from '@/components/favorite-button';

/**
 * Generate static params for recent episodes
 * Pre-renders the most recent 200 episodes at build time
 */
export async function generateStaticParams() {
  const { slugs } = await getRecentEpisodeSlugs(200);
  return slugs.map(slug => ({ slug }));
}

function HostLink({ host, className }: { host: unknown; className: string }) {
  const typedHost = host as { title?: string; name?: string; slug?: string };
  let href = '#';
  const displayName = typedHost.title || typedHost.name || 'Unknown';

  if (typedHost.slug) {
    href = `/hosts/${typedHost.slug}`;
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

function TakeoverLink({ takeover, className }: { takeover: any; className: string }) {
  const displayName = takeover.title || takeover.name || 'Unknown';
  let href = '#';

  if (takeover.slug) {
    href = `/takeovers/${takeover.slug}`;
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
  const { slug: showSlug } = await params;

  // First try to get episode from Cosmic
  const episode = await getEpisodeBySlug(showSlug);

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

  // Get related episodes based on genres, hosts and takeovers
  const hostIds = episode.metadata.regular_hosts?.map((host: any) => host.id).filter(Boolean) || [];
  const genreIds = episode.metadata.genres?.map((genre: any) => genre.id).filter(Boolean) || [];
  const takeoverIds = episode.metadata.takeovers?.map((takeover: any) => takeover.id).filter(Boolean) || [];
  const relatedEpisodesRaw = await getRelatedEpisodes(episode.id, 3, hostIds, genreIds, takeoverIds);
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
  const displayImage = getEpisodeImageUrl(episode);

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

  // Check if show is saved/favorited
  const user = await getAuthUser();
  let isSaved = false;
  let isHostFavorited = false;

  if (user) {
    try {
      const { data: userData } = await getUserData(user.id);
      if (userData?.metadata?.listen_later) {
        const savedIds = userData.metadata.listen_later.map((s: any) =>
          typeof s === 'string' ? s : s.id
        );
        isSaved = savedIds.includes(episode.id);
      }

      if (userData?.metadata?.favourite_hosts && episode.metadata.regular_hosts?.[0]) {
        const favoriteHostIds = userData.metadata.favourite_hosts.map((h: any) =>
          typeof h === 'string' ? h : h.id
        );
        isHostFavorited = favoriteHostIds.includes(episode.metadata.regular_hosts[0].id);
      }
    } catch (error) {
      console.error('Error checking user interaction status:', error);
    }
  }

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

      {/* Action Buttons */}
      <div className='px-5 mt-4 flex items-center gap-3'>
        {show?.metadata?.player && <ListenBackButton show={show} />}
        <SaveShowButton
          show={{ id: episode.id, slug: episode.slug, title: episode.title }}
          isSaved={isSaved}
        />
      </div>

      {/* Main Content Container */}

      <div className='w-full flex flex-col md:flex-row justify-between gap-8 px-5 pt-8'>
        {/*LEFT CONTAINER*/}
        <div className='w-full md:w-[40%] lg:w-[35%] flex flex-col gap-3'>
          {/* Episode Description */}
          {(episode.metadata.body_text || episode.metadata.description) && (
            <div className='max-w-none'>
              <SafeHtml
                content={episode.metadata.body_text || episode.metadata.description || ''}
                type='editorial-with-embeds'
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

          {/* Show Type, Hosts, Duration, and Broadcast Info Row */}
          {(episode.metadata.type?.title ||
            episode.metadata.regular_hosts?.length > 0 ||
            episode.metadata.duration ||
            episode.metadata.broadcast_date ||
            episode.metadata.broadcast_date_old) && (
            <div className='flex flex-row flex-wrap items-center gap-2'>
              {/* Show Type */}
              {episode.metadata.type?.title && (
                <>
                  <span className='text-m8 font-mono uppercase text-muted-foreground underline'>
                    {episode.metadata.type.title}
                  </span>
                  {(episode.metadata.regular_hosts?.length > 0 ||
                    episode.metadata.duration ||
                    episode.metadata.broadcast_date ||
                    episode.metadata.broadcast_date_old) && (
                    <span className='text-muted-foreground text-m8'>|</span>
                  )}
                </>
              )}

              {/* Hosts */}
              {episode.metadata.regular_hosts?.length > 0 && (
                <>
                  <div className='flex flex-row flex-wrap items-center gap-1'>
                    {episode.metadata.regular_hosts.map((host: any, index: number) => (
                      <React.Fragment key={host.id || host.slug}>
                        <div className='flex items-center gap-2'>
                          <HostLink
                            host={host}
                            className='text-m8 font-mono uppercase text-muted-foreground hover:text-foreground hover:underline underline transition-colors'
                          />
                          {index === 0 && (
                            <FavoriteButton
                              item={host}
                              type='host'
                              isFavorited={isHostFavorited}
                              variant='ghost'
                              className='text-muted-foreground hover:text-foreground'
                            />
                          )}
                        </div>
                        {index < episode.metadata.regular_hosts.length - 1 && (
                          <span className='text-muted-foreground text-m8 ml-1'>|</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  {(episode.metadata.takeovers?.length > 0 ||
                    episode.metadata.duration ||
                    episode.metadata.broadcast_date ||
                    episode.metadata.broadcast_date_old) && (
                    <span className='text-muted-foreground text-m8'>|</span>
                  )}
                </>
              )}

              {/* Takeovers */}
              {episode.metadata.takeovers?.length > 0 && (
                <>
                  <div className='flex flex-row flex-wrap items-center gap-1'>
                    {episode.metadata.takeovers.map((takeover: any, index: number) => (
                      <React.Fragment key={takeover.id || takeover.slug}>
                        <div className='flex items-center gap-2'>
                          <TakeoverLink
                            takeover={takeover}
                            className='text-m8 font-mono uppercase text-muted-foreground hover:text-foreground hover:underline underline transition-colors'
                          />
                        </div>
                        {index < episode.metadata.takeovers.length - 1 && (
                          <span className='text-muted-foreground text-m8 ml-1'>|</span>
                        )}
                      </React.Fragment>
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
                  )?.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
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

            const durationInMinutes = parseDurationToMinutes(episode.metadata.duration) || 120;

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
              <h2 className='text-h8 uppercase md:text-h7 font-bold tracking-tight leading-none'>
                Related Episodes
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
