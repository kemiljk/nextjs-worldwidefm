/** Missing end times have a bounded fallback; future and finished events are never current. */
export function isCurrentRadioEvent(
  event: { startTime: string; endTime?: string },
  now: number
): boolean {
  const start = Date.parse(event.startTime);
  const end = Date.parse(event.endTime || '');
  if (!Number.isFinite(start) || now < start) return false;
  return now < (Number.isFinite(end) ? end : start + 12 * 60 * 60 * 1000);
}
