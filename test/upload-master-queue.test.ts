import { describe, expect, it } from 'bun:test';
import {
  runUploadQueue,
  summariseUploadQueue,
  type UploadJobHandle,
  type UploadJobResult,
} from '@/lib/upload-master-queue';

const deferred = () => {
  let resolve!: (result: UploadJobResult) => void;
  const promise = new Promise<UploadJobResult>(done => (resolve = done));
  return { promise, resolve };
};

describe('runUploadQueue', () => {
  it('never starts a job before the previous one has finished', async () => {
    const events: string[] = [];
    const first = deferred();
    const handles: Record<string, UploadJobHandle> = {
      a: {
        submit: () => {
          events.push('start a');
          return first.promise.then(result => {
            events.push('end a');
            return result;
          });
        },
      },
      b: {
        submit: async () => {
          events.push('start b');
          return 'complete';
        },
      },
    };

    const run = runUploadQueue([
      { id: 'a', getHandle: () => handles.a },
      { id: 'b', getHandle: () => handles.b },
    ]);

    await Promise.resolve();
    expect(events).toEqual(['start a']);

    first.resolve('complete');
    expect(await run).toEqual({ a: 'complete', b: 'complete' });
    expect(events).toEqual(['start a', 'end a', 'start b']);
  });

  it('carries on after a failure and reports each result', async () => {
    const finished: string[] = [];
    const results = await runUploadQueue(
      [
        { id: 'a', getHandle: () => ({ submit: async () => 'failed' as const }) },
        {
          id: 'b',
          getHandle: () => ({
            submit: async () => {
              throw new Error('network down');
            },
          }),
        },
        { id: 'c', getHandle: () => ({ submit: async () => 'partial' as const }) },
        { id: 'd', getHandle: () => undefined },
      ],
      { onJobFinish: (id, result) => finished.push(`${id}:${result}`) }
    );

    expect(results).toEqual({ a: 'failed', b: 'failed', c: 'partial', d: 'skipped' });
    expect(finished).toEqual(['a:failed', 'b:failed', 'c:partial']);
  });

  it('stops before the next job when asked to', async () => {
    let stop = false;
    const results = await runUploadQueue(
      [
        {
          id: 'a',
          getHandle: () => ({
            submit: async () => {
              stop = true;
              return 'complete' as const;
            },
          }),
        },
        { id: 'b', getHandle: () => ({ submit: async () => 'complete' as const }) },
      ],
      { shouldStop: () => stop }
    );

    expect(results).toEqual({ a: 'complete' });
  });
});

describe('summariseUploadQueue', () => {
  it('lists only the states that are present', () => {
    expect(summariseUploadQueue(['done', 'done', 'failed', 'ready', 'empty'])).toBe(
      '2 uploaded, 1 failed, 1 ready, 1 not set up'
    );
    expect(summariseUploadQueue(['warning'])).toBe('1 uploaded with warnings');
    expect(summariseUploadQueue([])).toBe('');
  });
});
