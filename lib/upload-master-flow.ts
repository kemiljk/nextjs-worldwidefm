import { UPLOAD_CLIENT_TIMEOUT_MS } from '@/lib/upload-config';
import { fetchWithTimeout, type UploadFetchFn } from '@/lib/upload-fetch';

export type { UploadFetchFn };

export type UploadMasterFlowInput = {
  blobUrl: string;
  mediaFileName: string;
  episodeId: string;
  episodeSlug: string;
  mixcloudTitle: string;
  mixcloudTags: string[];
  mixcloudDescription: string;
  mixcloudImageUrl?: string;
  mixcloudHostUsernames: string[];
  broadcastDate: string;
  broadcastTime: string;
  duration: string;
  radiocultMetadata: {
    title: string;
    artist?: string;
  };
  regularHostIds: string[];
  fetchFn?: UploadFetchFn;
  clientTimeoutMs?: number;
};

export type UploadMasterFlowResult = {
  mixcloudUrl?: string;
  mixcloudError?: string;
  mixcloudWarning?: string;
  /** True once the Mixcloud URL is stored on the episode in Cosmic. */
  mixcloudLinkSaved: boolean;
  radiocultMediaId?: string;
  radioCultError?: string;
  archiveUpdated: boolean;
  archiveError?: string;
  blobUrl: string;
  shouldCleanupBlob: boolean;
  hasAnySuccess: boolean;
};

type JsonResponse = {
  success?: boolean;
  url?: string;
  warning?: string;
  episodeUpdated?: boolean;
  episodeUpdateError?: string;
  radiocultMediaId?: string;
  error?: string;
  details?: unknown;
};

export async function runUploadMasterFlow(
  input: UploadMasterFlowInput
): Promise<UploadMasterFlowResult> {
  const fetchImpl = input.fetchFn ?? fetch;
  const timeoutMs = input.clientTimeoutMs ?? UPLOAD_CLIENT_TIMEOUT_MS;

  let mixcloudUrl: string | undefined;
  let mixcloudError: string | undefined;
  let mixcloudWarning: string | undefined;
  let mixcloudLinkSaved = false;
  let radiocultMediaId: string | undefined;
  let radioCultError: string | undefined;
  let archiveUpdated = false;
  let archiveError: string | undefined;

  try {
    const mixcloudRes = await fetchWithTimeout('/api/upload-mixcloud', {
      method: 'POST',
      body: buildMixcloudFormData(input),
      timeoutMs,
      fetchFn: fetchImpl,
    });

    const mixcloudData = await parseJsonResponse(mixcloudRes);
    if (!mixcloudRes.ok || !mixcloudData.url) {
      const detailText = mixcloudData.details ? ` ${JSON.stringify(mixcloudData.details)}` : '';
      mixcloudError = `${mixcloudData.error || 'Mixcloud upload failed'}${detailText}`;
    } else {
      mixcloudUrl = mixcloudData.url;
      mixcloudWarning = mixcloudData.warning;
      mixcloudLinkSaved = mixcloudData.episodeUpdated === true;
    }
  } catch (error) {
    mixcloudError = error instanceof Error ? error.message : 'Mixcloud upload failed';
  }

  try {
    const uploadRes = await fetchWithTimeout('/api/upload-media', {
      method: 'POST',
      body: buildRadioCultFormData(input),
      timeoutMs,
      fetchFn: fetchImpl,
    });
    const uploadResult = await parseJsonResponse(uploadRes);

    if (!uploadRes.ok || !uploadResult.success || !uploadResult.radiocultMediaId) {
      throw new Error(uploadResult.error || 'RadioCult upload failed');
    }

    radiocultMediaId = uploadResult.radiocultMediaId;
  } catch (error) {
    radioCultError = error instanceof Error ? error.message : 'RadioCult upload failed';
  }

  try {
    const updateRes = await fetchWithTimeout(`/api/episodes/${input.episodeId}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(radiocultMediaId ? { radiocult_media_id: radiocultMediaId } : {}),
        ...(mixcloudUrl ? { player: mixcloudUrl, page_link: mixcloudUrl } : {}),
        regular_hosts: input.regularHostIds,
        slug: input.episodeSlug,
      }),
      timeoutMs,
      fetchFn: fetchImpl,
    });

    if (!updateRes.ok) {
      const updateData = await parseJsonResponse(updateRes);
      throw new Error(updateData.error || 'Failed to update episode');
    }

    archiveUpdated = true;
    if (mixcloudUrl) {
      mixcloudLinkSaved = true;
    }
  } catch (error) {
    archiveError = error instanceof Error ? error.message : 'Failed to update episode';
  }

  const shouldCleanupBlob = !mixcloudError && !radioCultError && !archiveError;

  if (shouldCleanupBlob) {
    try {
      await fetchWithTimeout('/api/upload-media', {
        method: 'POST',
        body: buildCleanupFormData(input.blobUrl),
        timeoutMs,
        fetchFn: fetchImpl,
      });
    } catch {
      // Cleanup failure should not mask a successful upload.
    }
  }

  const hasAnySuccess = Boolean(mixcloudUrl || radiocultMediaId || archiveUpdated);

  return {
    mixcloudUrl,
    mixcloudError,
    mixcloudWarning,
    mixcloudLinkSaved,
    radiocultMediaId,
    radioCultError,
    archiveUpdated,
    archiveError,
    blobUrl: input.blobUrl,
    shouldCleanupBlob,
    hasAnySuccess,
  };
}

function buildMixcloudFormData(input: UploadMasterFlowInput): FormData {
  const fd = new FormData();
  fd.append('mediaUrl', input.blobUrl);
  fd.append('fileName', input.mediaFileName);
  fd.append('cleanup', 'false');
  fd.append('episodeId', input.episodeId);
  fd.append('episodeSlug', input.episodeSlug);
  fd.append('title', input.mixcloudTitle);
  fd.append('tags', JSON.stringify(input.mixcloudTags));
  fd.append('description', input.mixcloudDescription);

  if (input.mixcloudImageUrl) {
    fd.append('imageUrl', input.mixcloudImageUrl);
  }

  if (input.mixcloudHostUsernames.length > 0) {
    fd.append('hosts', JSON.stringify(input.mixcloudHostUsernames));
  }

  fd.append('broadcastDate', input.broadcastDate);
  fd.append('broadcastTime', input.broadcastTime);
  fd.append('duration', input.duration);

  return fd;
}

function buildRadioCultFormData(input: UploadMasterFlowInput): FormData {
  const mediaFormData = new FormData();
  mediaFormData.append('mediaUrl', input.blobUrl);
  mediaFormData.append('fileName', input.mediaFileName);
  mediaFormData.append('cleanup', 'false');
  mediaFormData.append('metadata', JSON.stringify(input.radiocultMetadata));
  return mediaFormData;
}

function buildCleanupFormData(blobUrl: string): FormData {
  const fd = new FormData();
  fd.append('mediaUrl', blobUrl);
  fd.append('cleanupOnly', 'true');
  return fd;
}

async function parseJsonResponse(response: Response): Promise<JsonResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as JsonResponse;
  } catch {
    return { error: text || `Request failed (HTTP ${response.status})` };
  }
}

export function buildUploadResultSummary(result: UploadMasterFlowResult): string {
  const parts: string[] = [];

  if (result.mixcloudUrl) {
    parts.push(
      result.mixcloudWarning
        ? `Mixcloud: uploaded (${result.mixcloudWarning})`
        : 'Mixcloud: uploaded'
    );
  } else if (result.mixcloudError) {
    parts.push(`Mixcloud: failed (${result.mixcloudError})`);
  }

  if (result.mixcloudUrl && !result.mixcloudLinkSaved) {
    parts.push(`Mixcloud link NOT saved to the show page — add it manually: ${result.mixcloudUrl}`);
  }

  if (result.radiocultMediaId) {
    parts.push('RadioCult: uploaded');
  } else if (result.radioCultError) {
    parts.push(`RadioCult: failed (${result.radioCultError})`);
  }

  if (result.archiveUpdated) {
    parts.push('Website archive: updated');
  } else if (result.archiveError) {
    parts.push(`Website archive: failed (${result.archiveError})`);
  }

  if (!result.shouldCleanupBlob) {
    parts.push(`Raw audio kept at ${result.blobUrl}`);
  }

  return parts.join(' · ');
}
