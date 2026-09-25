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
      error.name === 'TimeoutError' ||
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

/** Bounds an entire operation, including response consumption, with cancellation. */
export async function withUploadTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal | null
): Promise<T> {
  const controller = new AbortController();
  const timeoutError = new Error('Upload timeout: request timed out');
  timeoutError.name = 'TimeoutError';
  let rejectAbort: (reason: unknown) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const abort = (reason: unknown) => {
    rejectAbort(reason);
    controller.abort();
  };
  const abortExternal = () => abort(new DOMException('Upload aborted', 'AbortError'));
  if (externalSignal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
  if (timeoutMs <= 0) throw timeoutError;
  const timer = setTimeout(() => abort(timeoutError), timeoutMs);
  externalSignal?.addEventListener('abort', abortExternal, { once: true });
  try {
    return await Promise.race([aborted, operation(controller.signal)]);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortExternal);
  }
}

export function remainingUploadTime(deadline: number, capMs = Infinity): number {
  return Math.max(0, Math.min(capMs, deadline - performance.now()));
}

type BodyFetchOptions = FetchWithTimeoutOptions & {
  deadline?: number;
  onAttempt?: (attempt: number) => void;
};

export async function fetchWithBody<T>(
  input: RequestInfo | URL,
  consume: (response: Response) => Promise<T>,
  options: BodyFetchOptions = {}
): Promise<T> {
  const {
    timeoutMs = UPLOAD_CLIENT_TIMEOUT_MS,
    deadline = Infinity,
    onAttempt,
    signal,
    fetchFn = fetch,
    ...init
  } = options;
  onAttempt?.(1);
  return withUploadTimeout(
    async abortSignal => {
      const response = await fetchFn(input, { ...init, signal: abortSignal });
      try {
        return await consume(response);
      } finally {
        // A rejected response may not have been consumed. Release its connection.
        if (response.body && !response.body.locked)
          void Promise.resolve(response.body.cancel()).catch(() => undefined);
      }
    },
    remainingUploadTime(deadline, timeoutMs),
    signal
  );
}

export async function fetchWithBodyRetry<T>(
  input: RequestInfo | URL,
  consume: (response: Response) => Promise<T>,
  options: BodyFetchOptions = {}
): Promise<T> {
  const deadline =
    options.deadline ?? performance.now() + (options.timeoutMs ?? UPLOAD_CLIENT_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    let responseStatus: number | undefined;
    try {
      options.onAttempt?.(attempt + 1);
      return await fetchWithBody(
        input,
        async response => {
          responseStatus = response.status;
          if (isRetryableUploadError(undefined, response.status) && attempt < UPLOAD_MAX_RETRIES)
            throw new Error('Upload network service unavailable');
          return consume(response);
        },
        { ...options, deadline, onAttempt: undefined }
      );
    } catch (error) {
      if (
        attempt >= UPLOAD_MAX_RETRIES ||
        // Once a mutation has a non-retryable response, a body timeout must not replay it.
        (options.method?.toUpperCase() === 'POST' &&
          responseStatus !== undefined &&
          !isRetryableUploadError(undefined, responseStatus)) ||
        options.signal?.aborted ||
        !isRetryableUploadError(error)
      )
        throw error;
      if (remainingUploadTime(deadline) <= UPLOAD_RETRY_DELAY_MS)
        throw new Error('Upload timed out before retry');
      await withUploadTimeout(
        () => delay(UPLOAD_RETRY_DELAY_MS),
        remainingUploadTime(deadline),
        options.signal
      );
    }
  }
}

/** Metadata-only telemetry: never pass source URLs or provider credentials. */
export function uploadAttemptLogger(destination: string, stage: string, bytes?: number) {
  const started = performance.now();
  return (attempt: number) =>
    console.info('[upload] attempt', {
      destination,
      stage,
      attempt,
      elapsedMs: Math.round(performance.now() - started),
      ...(bytes === undefined ? {} : { bytes }),
    });
}
