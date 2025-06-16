import { cosmic } from "@/lib/cosmic-config";

// Convert a display name to slug format
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters except hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

// Calculate simple string similarity (Levenshtein-like)
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

interface HostMatch {
  slug: string;
  title: string;
  similarity: number;
}

// Cache for host data to avoid repeated API calls
let hostsCache: { slug: string; title: string }[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getHosts() {
  const now = Date.now();

  // Return cached data if it's still valid
  if (hostsCache && now - cacheTimestamp < CACHE_DURATION) {
    return hostsCache;
  }

  try {
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
        status: "published",
      })
      .props("slug,title")
      .limit(1000);

    hostsCache =
      response.objects?.map((host: any) => ({
        slug: host.slug,
        title: host.title,
      })) || [];

    cacheTimestamp = now;
    return hostsCache;
  } catch (error) {
    console.error("Error fetching hosts for matching:", error);
    return [];
  }
}

/**
 * Find the best matching host slug for a given display name
 * @param displayName - The host display name (e.g., "Pedro Montenegro")
 * @param threshold - Minimum similarity threshold (0-1, default 0.6)
 * @returns The best matching slug or null if no good match found
 */
export async function findHostSlug(displayName: string, threshold = 0.6): Promise<string | null> {
  if (!displayName?.trim()) return null;

  const hosts = await getHosts();
  if (!hosts || !hosts.length) return null;

  const targetSlug = nameToSlug(displayName);
  const matches: HostMatch[] = [];

  for (const host of hosts) {
    // Check similarity against slug
    const slugSimilarity = stringSimilarity(targetSlug, host.slug);

    // Check similarity against title (converted to slug format)
    const titleSlug = nameToSlug(host.title);
    const titleSimilarity = stringSimilarity(targetSlug, titleSlug);

    // Also check direct name similarity
    const nameSimilarity = stringSimilarity(displayName.toLowerCase(), host.title.toLowerCase());

    // Use the highest similarity score
    const similarity = Math.max(slugSimilarity, titleSimilarity, nameSimilarity);

    if (similarity >= threshold) {
      matches.push({
        slug: host.slug,
        title: host.title,
        similarity,
      });
    }
  }

  // Sort by similarity (highest first) and return the best match
  matches.sort((a, b) => b.similarity - a.similarity);

  const bestMatch = matches[0];
  if (bestMatch) {
    console.log(`🔍 Host matcher: "${displayName}" → "${bestMatch.slug}" (${(bestMatch.similarity * 100).toFixed(1)}% match)`);
    return bestMatch.slug;
  }

  console.log(`❌ Host matcher: No good match found for "${displayName}" (tried slug: "${targetSlug}")`);
  return null;
}

/**
 * Convert a display name to a fallback slug format
 * @param displayName - The host display name
 * @returns A slug format string
 */
export function displayNameToSlug(displayName: string): string {
  return nameToSlug(displayName);
}
