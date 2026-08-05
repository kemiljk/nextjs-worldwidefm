import {
  UPLOAD_CLIENT_TIMEOUT_MS,
  UPLOAD_RETRY_DELAY_MS,
  UPLOAD_MAX_RETRIES,
} from '@/lib/upload-config';

export type UploadFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
  fetchFn?: UploadFetchFn;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = UPLOAD_CLIENT_TIMEOUT_MS,
    signal: externalSignal,
    fetchFn = fetch,
    ...init
  } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

  try {
    return await fetchFn(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export function isRetryableUploadError(error: unknown, status?: number): boolean {
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return false;
  }

  if (typeof status === 'number' && status >= 500) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      error.name === 'AbortError' ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('econnreset') ||
      message.includes('socket')
    );
  }

  return false;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, options);
      if (
        !response.ok &&
        isRetryableUploadError(undefined, response.status) &&
        attempt < UPLOAD_MAX_RETRIES
      ) {
        await delay(UPLOAD_RETRY_DELAY_MS);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadError(error) || attempt >= UPLOAD_MAX_RETRIES) {
        throw error;
      }

      await delay(UPLOAD_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Upload request failed');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
