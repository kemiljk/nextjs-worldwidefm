import { describe, expect, it } from 'bun:test';
import { uploadMediaToRadioCult } from '@/lib/radiocult-upload';
import { uploadMediaToMixcloud } from '@/lib/mixcloud-upload';

const audio = new Uint8Array([0xff, 0xfb, 0xe0, 0x40]);
function stalledResponse() {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{'));
      },
    })
  );
}

describe('provider end-to-end deadlines', () => {
  for (const provider of ['RadioCult', 'Mixcloud'] as const) {
    for (const stage of ['download', 'upload'] as const) {
      it(`${provider} bounds a stalled ${stage} body and retains the source`, async () => {
        let posts = 0;
        const server = Bun.serve({
          port: 0,
          async fetch(request) {
            if (request.method === 'POST') {
              posts++;
              await request.arrayBuffer();
              return stalledResponse();
            }
            return stage === 'download' ? stalledResponse() : new Response(audio);
          },
        });
        const base = `http://127.0.0.1:${server.port}`;
        const started = performance.now();
        try {
          const input = {
            mediaUrl: `${base}/audio.mp3`,
            fileName: 'master.mp3',
            apiBaseUrl: base,
            deadline: started + 100,
          };
          const result =
            provider === 'RadioCult'
              ? await uploadMediaToRadioCult({ ...input, stationId: 'station', secretKey: 'test' })
              : await uploadMediaToMixcloud({ ...input, title: 'Show', accessToken: 'test' });
          expect(result.success).toBe(false);
          if (!result.success) expect(result.error).toMatch(/timeout|timed out/i);
          expect(performance.now() - started).toBeLessThan(1000);
          expect(posts).toBe(stage === 'download' ? 0 : 1);
        } finally {
          server.stop(true);
        }
      });
    }
  }

  for (const stage of ['artwork', 'lookup', 'schedule', 'description'] as const) {
    it(`Mixcloud ${stage} shares the provider deadline`, async () => {
      let posts = 0;
      const server = Bun.serve({
        port: 0,
        async fetch(request) {
          if (request.method === 'POST') {
            posts++;
            await request.arrayBuffer();
            if (stage === 'lookup') return Response.json({ result: { success: true } });
            if (stage === 'schedule' || stage === 'description') {
              await new Promise(resolve => setTimeout(resolve, 70));
              return Response.json(
                {
                  error: {
                    message:
                      stage === 'schedule' ? 'Invalid publish_date' : 'description exceeds 1000',
                  },
                },
                { status: 400 }
              );
            }
          }
          return stalledResponse();
        },
      });
      const base = `http://127.0.0.1:${server.port}`;
      const started = performance.now();
      try {
        const result = await uploadMediaToMixcloud({
          audioFile: new File([audio], 'master.mp3'),
          title: 'Show',
          description: 'Description',
          accessToken: 'test',
          apiBaseUrl: base,
          deadline: started + (stage === 'lookup' ? 1200 : 100),
          ...(stage === 'artwork' ? { imageUrl: `${base}/cover.jpg` } : {}),
          ...(stage === 'schedule'
            ? { broadcastDate: '2099-01-01', broadcastTime: '18:00', duration: '240' }
            : {}),
        });
        expect(result.success).toBe(false);
        expect(performance.now() - started).toBeLessThan(2000);
        expect(posts).toBe(stage === 'artwork' ? 0 : stage === 'lookup' ? 1 : 2);
      } finally {
        server.stop(true);
      }
    });
  }
});

it('keeps an accepted Mixcloud upload successful when URL lookup times out', async () => {
  const oldUsername = process.env.MIXCLOUD_USERNAME;
  process.env.MIXCLOUD_USERNAME = 'test';
  let lookups = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method === 'POST') {
        await request.arrayBuffer();
        return Response.json({ result: { success: true } });
      }
      lookups++;
      return stalledResponse();
    },
  });
  try {
    const result = await uploadMediaToMixcloud({
      audioFile: new File([audio], 'master.mp3'),
      title: 'Show',
      accessToken: 'test',
      apiBaseUrl: `http://127.0.0.1:${server.port}`,
      deadline: performance.now() + 1200,
    });
    expect(lookups).toBe(1);
    expect(result.success).toBe(true);
    if (result.success) expect(result.url).toBe('https://www.mixcloud.com/test/show/');
  } finally {
    server.stop(true);
    if (oldUsername === undefined) delete process.env.MIXCLOUD_USERNAME;
    else process.env.MIXCLOUD_USERNAME = oldUsername;
  }
});
