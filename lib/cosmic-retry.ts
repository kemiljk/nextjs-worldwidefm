const RETRY_DELAYS = [500, 1000, 2000];

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('status' in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status >= 500;
  }

  if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
    const msg = (error as { message: string }).message.toLowerCase();
    return msg.includes('internal server error') || msg.includes('rate limit') || msg.includes('timeout');
  }

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_DELAYS.length && isRetryableError(error)) {
        const delay = RETRY_DELAYS[attempt];
        if (label) {
          console.warn(`[cosmic-retry] ${label}: attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}
