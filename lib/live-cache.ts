/** Never retain a now-playing response beyond a known programme boundary. */
export function liveCacheHeaders(
  now: number,
  boundaries: Array<string | undefined>
): Record<string, string> {
  const seconds = boundaries
    .map(value => Date.parse(value || '') - now)
    .filter(Number.isFinite)
    .map(ms => Math.floor(ms / 1000));
  const ttl = Math.max(0, Math.min(5, ...seconds));
  if (!ttl) return { 'Cache-Control': 'no-store' };
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': `public, s-maxage=${ttl}`,
    'Vercel-CDN-Cache-Control': `public, s-maxage=${ttl}`,
  };
}
