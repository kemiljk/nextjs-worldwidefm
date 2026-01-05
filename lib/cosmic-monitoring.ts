/**
 * CosmicJS Cost Monitoring Utilities
 * 
 * Use these utilities to track API bandwidth and validate optimizations.
 * 
 * MONITORING RECOMMENDATIONS:
 * 
 * 1. **Cosmic Dashboard** → API Bandwidth usage (should drop 60-70%)
 *    - Check daily/weekly bandwidth trends
 *    - Monitor API Non-Cached Requests count
 * 
 * 2. **imgix Dashboard** → Image optimization and CDN hits
 *    - Monitor cache hit rates
 *    - Check bandwidth usage
 *    - Note: Using native <img> with imgix params avoids Vercel Image costs
 * 
 * 3. **API Response Times** → Should improve with smaller payloads
 *    - Use browser DevTools to monitor response sizes
 *    - Check for reduced payload sizes in Network tab
 * 
 * EXPECTED COST REDUCTION:
 * - API Bandwidth: $258.84 → ~$80-100 (60-70% reduction from .props() field selection)
 * - Media Bandwidth: $153.30 → ~$100-120 (30-40% reduction via imgix params)
 * - API Non-Cached Requests: Minimal reduction (pages use dynamic rendering for instant updates)
 * - Target Monthly Cost: $180-220 (down from $471)
 * 
 * CACHING STRATEGY:
 * - Pages use `await connection()` for dynamic rendering (instant Cosmic updates)
 * - API bandwidth reduced via .props() field selection (60-70% smaller payloads)
 * - Vercel Edge caching still applies to static assets
 * - On-demand revalidation available via /api/revalidate endpoint
 * 
 * IMAGE OPTIMIZATION STRATEGY:
 * - Using native <img> with imgix URL params (no Vercel Image costs)
 * - imgix provides: WebP/AVIF auto-format, responsive sizing, compression
 * - Helper: getOptimizedImageUrl() in components/ui/optimized-image.tsx
 */

// Development-only logging for API response sizes
const isDev = process.env.NODE_ENV === 'development';

interface ApiCallMetrics {
  endpoint: string;
  responseSize: number;
  duration: number;
  timestamp: Date;
  props?: string;
  depth?: number;
}

const metrics: ApiCallMetrics[] = [];

export function logApiCall(
  endpoint: string,
  responseSize: number,
  duration: number,
  options?: { props?: string; depth?: number }
) {
  if (!isDev) return;

  const metric: ApiCallMetrics = {
    endpoint,
    responseSize,
    duration,
    timestamp: new Date(),
    props: options?.props,
    depth: options?.depth,
  };

  metrics.push(metric);

  // Log to console in development
  const sizeKB = (responseSize / 1024).toFixed(2);
  console.log(
    `[Cosmic API] ${endpoint}: ${sizeKB}KB in ${duration}ms` +
      (options?.props ? ` (props: ${options.props.substring(0, 50)}...)` : '') +
      (options?.depth !== undefined ? ` (depth: ${options.depth})` : '')
  );
}

export function getMetricsSummary() {
  if (metrics.length === 0) {
    return { totalCalls: 0, totalSize: 0, averageSize: 0, averageDuration: 0 };
  }

  const totalSize = metrics.reduce((sum, m) => sum + m.responseSize, 0);
  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);

  return {
    totalCalls: metrics.length,
    totalSize,
    totalSizeKB: (totalSize / 1024).toFixed(2),
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    averageSize: totalSize / metrics.length,
    averageSizeKB: (totalSize / metrics.length / 1024).toFixed(2),
    averageDuration: totalDuration / metrics.length,
  };
}

export function clearMetrics() {
  metrics.length = 0;
}

/**
 * Estimate monthly bandwidth cost based on current usage patterns
 * 
 * Cosmic Pricing:
 * - API Bandwidth: $0.36/GB
 * - Media Bandwidth: $0.30/GB
 */
export function estimateMonthlyCost(
  dailyApiRequestsKB: number,
  dailyMediaRequestsKB: number
) {
  const daysPerMonth = 30;
  
  const monthlyApiGB = (dailyApiRequestsKB * daysPerMonth) / 1024 / 1024;
  const monthlyMediaGB = (dailyMediaRequestsKB * daysPerMonth) / 1024 / 1024;
  
  const apiCost = monthlyApiGB * 0.36;
  const mediaCost = monthlyMediaGB * 0.30;
  
  return {
    monthlyApiGB: monthlyApiGB.toFixed(2),
    monthlyMediaGB: monthlyMediaGB.toFixed(2),
    estimatedApiCost: `$${apiCost.toFixed(2)}`,
    estimatedMediaCost: `$${mediaCost.toFixed(2)}`,
    estimatedTotalCost: `$${(apiCost + mediaCost).toFixed(2)}`,
  };
}

/**
 * Recommended field selection strings for common object types
 * Use these as reference when adding .props() to Cosmic queries
 */
export const RECOMMENDED_PROPS = {
  episode: 'id,slug,title,type,created_at,metadata.image,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage',
  episodeDetail: 'id,slug,title,type,status,created_at,metadata.image,metadata.broadcast_date,metadata.broadcast_date_old,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.body_text,metadata.player,metadata.tracklist,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage',
  host: 'id,slug,title,type,content,metadata.image,metadata.description,metadata.genres,metadata.locations',
  takeover: 'id,slug,title,type,content,metadata.image,metadata.description,metadata.regular_hosts',
  post: 'id,slug,title,metadata.image,metadata.description,metadata.excerpt,metadata.date,metadata.categories,metadata.author,metadata.type',
  genre: 'id,slug,title',
  location: 'id,slug,title',
  search: 'id,slug,title,created_at,metadata.image,metadata.description,metadata.subtitle,metadata.excerpt,metadata.broadcast_date,metadata.date,metadata.genres,metadata.categories,metadata.locations,metadata.regular_hosts,metadata.takeovers',
} as const;

