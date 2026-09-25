import { describe, expect, it } from 'bun:test';
import { fetchWithBody, fetchWithBodyRetry } from '@/lib/upload-fetch';

describe('upload body deadlines', () => {
  it('aborts a stalled body after headers and cancels its stream', async () => {
    let signal: AbortSignal | undefined;
    let cancelled = false;
    await expect(
      fetchWithBody('https://example.test', response => response.text(), {
        timeoutMs: 20,
        fetchFn: async (_, init) => {
          signal = init?.signal as AbortSignal;
          return new Response(
            new ReadableStream({
              start(controller) {
                signal?.addEventListener('abort', () => {
                  cancelled = true;
                  controller.error(new Error('aborted'));
                });
              },
            })
          );
        },
      })
    ).rejects.toThrow(/timed out/i);
    expect(signal?.aborted).toBe(true);
    expect(cancelled).toBe(true);
  });

  it('does not start a retry when its delay would exceed the deadline', async () => {
    let calls = 0;
    await expect(
      fetchWithBodyRetry('https://example.test', response => response.text(), {
        timeoutMs: 100,
        deadline: performance.now() + 50,
        fetchFn: async () => {
          calls++;
          return new Response('unavailable', { status: 503 });
        },
      })
    ).rejects.toThrow(/timed out/i);
    expect(calls).toBe(1);
  });

  it('does not start a request with an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await expect(
      fetchWithBody('https://example.test', response => response.text(), {
        signal: controller.signal,
        fetchFn: async () => {
          calls++;
          return new Response('ok');
        },
      })
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
});

it('clears the deadline after successful body consumption', async () => {
  let signal: AbortSignal | undefined;
  const body = await fetchWithBody('https://example.test', response => response.text(), {
    timeoutMs: 20,
    fetchFn: async (_, init) => {
      signal = init?.signal as AbortSignal;
      return new Response('complete');
    },
  });
  await new Promise(resolve => setTimeout(resolve, 40));
  expect(body).toBe('complete');
  expect(signal?.aborted).toBe(false);
});

it('cancels an in-flight body when the caller aborts', async () => {
  const controller = new AbortController();
  const pending = fetchWithBody('https://example.test', response => response.text(), {
    signal: controller.signal,
    fetchFn: async (_, init) =>
      new Response(
        new ReadableStream({
          start(stream) {
            init?.signal?.addEventListener('abort', () => stream.error(new Error('aborted')));
          },
        })
      ),
  });
  controller.abort();
  await expect(pending).rejects.toThrow(/aborted/i);
});

it('does not retry a rejected 4xx upload', async () => {
  let calls = 0;
  const status = await fetchWithBodyRetry(
    'https://example.test',
    async response => response.status,
    {
      fetchFn: async () => {
        calls++;
        return new Response('rejected', { status: 413 });
      },
    }
  );
  expect(status).toBe(413);
  expect(calls).toBe(1);
});

it('clamps a second attempt to the remaining deadline', async () => {
  let calls = 0;
  const started = performance.now();
  await expect(
    fetchWithBodyRetry('https://example.test', response => response.text(), {
      deadline: started + 2100,
      timeoutMs: 5000,
      fetchFn: async (_, init) => {
        calls++;
        if (calls === 1) return new Response('unavailable', { status: 503 });
        return new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
            },
          })
        );
      },
    })
  ).rejects.toThrow(/timeout/i);
  expect(calls).toBe(2);
  expect(performance.now() - started).toBeLessThan(2600);
});

it('does not resubmit an accepted POST when its success body times out', async () => {
  let calls = 0;
  await expect(
    fetchWithBodyRetry('https://example.test', response => response.text(), {
      method: 'POST',
      timeoutMs: 20,
      deadline: performance.now() + 4000,
      fetchFn: async (_, init) => {
        calls++;
        return new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
            },
          }),
          { status: 200 }
        );
      },
    })
  ).rejects.toThrow(/timeout/i);
  expect(calls).toBe(1);
});
