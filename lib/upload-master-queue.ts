import type { UploadFormOutcome } from './upload-master-flow';

/**
 * Several master uploads can be set up in one tab, but they must run one at a
 * time: the uploads share a Mixcloud account and the same serverless budget, and
 * overlapping runs were the cause of silent errors when staff used several tabs.
 */
export type UploadJobStatus = 'empty' | 'ready' | 'uploading' | 'done' | 'warning' | 'failed';

/** `skipped` means the upload never started (nothing chosen, or another upload was running). */
export type UploadJobResult = UploadFormOutcome | 'skipped';

export interface UploadJobHandle {
  submit(): Promise<UploadJobResult>;
}

export interface UploadQueueJob {
  id: string;
  /** Looked up when the job's turn comes, so it always sees the latest state. */
  getHandle(): UploadJobHandle | undefined;
}

export interface UploadQueueHooks {
  onJobStart?(id: string): void;
  onJobFinish?(id: string, result: UploadJobResult): void;
  /** Checked before each job starts; return true to stop the queue (e.g. page left). */
  shouldStop?(): boolean;
}

/** Runs jobs strictly one after another and never throws; one failure does not stop the rest. */
export async function runUploadQueue(
  jobs: UploadQueueJob[],
  hooks: UploadQueueHooks = {}
): Promise<Record<string, UploadJobResult>> {
  const results: Record<string, UploadJobResult> = {};
  for (const job of jobs) {
    if (hooks.shouldStop?.()) break;
    const handle = job.getHandle();
    if (!handle) {
      results[job.id] = 'skipped';
      continue;
    }
    hooks.onJobStart?.(job.id);
    let result: UploadJobResult;
    try {
      result = await handle.submit();
    } catch {
      result = 'failed';
    }
    results[job.id] = result;
    hooks.onJobFinish?.(job.id, result);
  }
  return results;
}

/** One-line status across all queued shows, e.g. "2 uploaded, 1 failed". */
export function summariseUploadQueue(statuses: UploadJobStatus[]): string {
  const count = (status: UploadJobStatus) => statuses.filter(item => item === status).length;
  const parts = [
    [count('done'), 'uploaded'],
    [count('warning'), 'uploaded with warnings'],
    [count('failed'), 'failed'],
    [count('uploading'), 'uploading'],
    [count('ready'), 'ready'],
    [count('empty'), 'not set up'],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(', ');
}
