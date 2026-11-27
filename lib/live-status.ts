/**
 * RadioCult reports the overnight playlist as a "programme" too, so a title
 * alone does not mean a show is on air. These helpers separate a real show
 * from the playlist / unknown state shown in the live bar.
 */
export function isPlaylistTitle(title: string | undefined | null): boolean {
  const lower = (title || '').toLowerCase();
  if (!lower) return false;
  return lower.includes('playlist') || (lower.includes('wwfm') && !lower.includes('show'));
}

export interface LiveStatusInput {
  /** Name of the show the schedule says is on now, if any. */
  scheduleShowName?: string | null;
  /** Title RadioCult is reporting for the current programme, if any. */
  streamTitle?: string | null;
}

export interface LiveStatus {
  /** Show the listener will hear is a real, scheduled show (not the playlist). */
  isOnAir: boolean;
  /** The bar should say "Check out our schedule" instead of a show title. */
  isPlaylist: boolean;
}

export function getLiveStatus({ scheduleShowName, streamTitle }: LiveStatusInput): LiveStatus {
  if (scheduleShowName) return { isOnAir: true, isPlaylist: false };
  if (!streamTitle) return { isOnAir: false, isPlaylist: false };
  const isPlaylist = isPlaylistTitle(streamTitle);
  return { isOnAir: !isPlaylist, isPlaylist };
}
