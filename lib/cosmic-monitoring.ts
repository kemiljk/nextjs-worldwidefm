/**
 * Development-only payload diagnostics. Production cache-fill metrics are emitted
 * by cosmic-public.ts as cosmic.read events (operation, fingerprint, status, bytes,
 * durationMs, attempt). Compare upstream reads per 1,000 page views and real invoices;
 * a Cosmic CDN hit is still a billable request. No fixed savings estimate is assumed.
 * See docs/assessments/2026-09-07-performance/implementation.md for cache policy.
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
export function estimateMonthlyCost(dailyApiRequestsKB: number, dailyMediaRequestsKB: number) {
  const daysPerMonth = 30;

  const monthlyApiGB = (dailyApiRequestsKB * daysPerMonth) / 1024 / 1024;
  const monthlyMediaGB = (dailyMediaRequestsKB * daysPerMonth) / 1024 / 1024;

  const apiCost = monthlyApiGB * 0.36;
  const mediaCost = monthlyMediaGB * 0.3;

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
  episode:
    'id,slug,title,type,created_at,metadata.image,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage',
  episodeDetail:
    'id,slug,title,type,status,created_at,metadata.image,metadata.broadcast_date,metadata.broadcast_date_old,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.body_text,metadata.player,metadata.tracklist,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage',
  host: 'id,slug,title,type,content,metadata.image,metadata.description,metadata.genres,metadata.locations',
  takeover: 'id,slug,title,type,content,metadata.image,metadata.description,metadata.regular_hosts',
  post: 'id,slug,title,metadata.image,metadata.description,metadata.excerpt,metadata.date,metadata.categories,metadata.author,metadata.type',
  genre: 'id,slug,title',
  location: 'id,slug,title',
  search:
    'id,slug,title,created_at,metadata.image,metadata.description,metadata.subtitle,metadata.excerpt,metadata.broadcast_date,metadata.date,metadata.genres,metadata.categories,metadata.locations,metadata.regular_hosts,metadata.takeovers',
} as const;
