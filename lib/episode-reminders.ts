import { parseBroadcastDateTime } from './date-utils';

export const EPISODE_REMINDER_LEAD_MINUTES = 10;

/** Returns null for past shows or shows outside the browser timer range. */
export function getEpisodeReminderDelay(startMs: number, nowMs: number): number | null {
  if (!Number.isFinite(startMs) || startMs <= nowMs) return null;
  const delay = Math.max(0, startMs - EPISODE_REMINDER_LEAD_MINUTES * 60_000 - nowMs);
  return delay <= 2_147_483_647 ? delay : null;
}

/** Episode identifiers are stored separately from recurring schedule reminders. */
export function parseEpisodeReminderIds(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(item)
          )
        ),
      ].slice(0, 100)
    : [];
}

export function episodeStartTime(metadata: {
  broadcast_date?: string | null;
  broadcast_date_old?: string | null;
  broadcast_time?: string | null;
}): Date | null {
  const date = metadata.broadcast_date || metadata.broadcast_date_old;
  // A date alone does not tell us when the broadcast starts.
  if (!date || (!date.includes('T') && !metadata.broadcast_time)) return null;
  return parseBroadcastDateTime(
    metadata.broadcast_date,
    metadata.broadcast_time,
    metadata.broadcast_date_old
  );
}
