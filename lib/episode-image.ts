type ImageFields = {
  external_image_url?: unknown;
  image?: unknown;
};

function ownImage(fields: ImageFields | null | undefined): string {
  if (!fields) return '';
  if (typeof fields.external_image_url === 'string' && fields.external_image_url) {
    return fields.external_image_url;
  }
  const image = fields.image as { imgix_url?: string | null; url?: string | null } | null;
  return image?.imgix_url || image?.url || '';
}

/**
 * The episode's own image, else its first host's. Weekly show pages are created
 * without an image so anything staff upload wins; until then they show the host.
 * Returns '' when neither exists so callers can pick their own placeholder.
 */
export function resolveEpisodeImage(
  metadata: (ImageFields & { regular_hosts?: unknown }) | null | undefined
): string {
  const own = ownImage(metadata);
  if (own) return own;

  const hosts = Array.isArray(metadata?.regular_hosts) ? metadata.regular_hosts : [];
  for (const host of hosts) {
    const hostImage = ownImage((host as { metadata?: ImageFields } | null)?.metadata);
    if (hostImage) return hostImage;
  }
  return '';
}
