import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { uploadMediaToMixcloud } from '../../lib/mixcloud-upload';
import { uploadMediaToRadioCult } from '../../lib/radiocult-upload';
import { buildId3v23Tag, writeMp3Id3v23Metadata } from '../../lib/mp3-utils';

for (const provider of ['Mixcloud', 'RadioCult'] as const) {
  test(`${provider}: sends before source ends, preserving bytes and multipart metadata`, async () => {
    const audio = Buffer.alloc(128 * 1024, 0xff);
    audio[1] = 0xfb;
    let unblock = () => {};
    const destinationStarted = new Promise<void>(resolve => {
      unblock = resolve;
    });
    let received: Buffer | undefined;
    let declared = 0;
    let actual = 0;
    const server = createServer(async (req, res) => {
      try {
        if (req.method === 'GET') {
          res.writeHead(200, { 'content-length': audio.length });
          res.write(audio.subarray(0, 65536));
          await destinationStarted;
          res.end(audio.subarray(65536));
          return;
        }
        unblock();
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        actual = body.length;
        declared = Number(req.headers['content-length']);
        const form = await new Response(body, {
          headers: { 'content-type': req.headers['content-type']! },
        }).formData();
        received = Buffer.from(
          await (form.get(provider === 'Mixcloud' ? 'mp3' : 'stationMedia') as File).arrayBuffer()
        );
        assert.equal(
          form.get(provider === 'Mixcloud' ? 'name' : 'metadata'),
          provider === 'Mixcloud' ? 'Show' : JSON.stringify({ title: 'Show' })
        );
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify(
            provider === 'Mixcloud' ? { key: '/test/show/' } : { track: { id: 'track' } }
          )
        );
      } catch (error) {
        res.destroy(error as Error);
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const input = {
        mediaUrl: `${base}/audio.mp3`,
        fileName: 'show.mp3',
        apiBaseUrl: base,
        deadline: performance.now() + 1500,
      };
      const result =
        provider === 'Mixcloud'
          ? await uploadMediaToMixcloud({ ...input, title: 'Show', accessToken: 'test' })
          : await uploadMediaToRadioCult({
              ...input,
              metadata: { title: 'Show' },
              stationId: 'test',
              secretKey: 'test',
            });
      assert.equal(result.success, true, JSON.stringify(result));
      assert.deepEqual(
        received,
        provider === 'Mixcloud' ? audio : writeMp3Id3v23Metadata(audio, { title: 'Show' })
      );
      assert.equal(declared, actual);
    } finally {
      unblock();
      server.closeAllConnections();
      server.close();
    }
  });
}

async function fixture(handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>) {
  const errors: unknown[] = [];
  const server = createServer((req, res) => {
    void handler(req, res).catch(error => {
      errors.push(error);
      res.destroy();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    base: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    errors,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}
async function multipart(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return new Response(Buffer.concat(chunks), {
    headers: { 'content-type': req.headers['content-type']! },
  }).formData();
}
function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}
const frames = Buffer.from([0xff, 0xfb, 0xe0, 0x40, ...Array(128).fill(42)]);

for (const chunked of [false, true]) {
  test(`RadioCult replaces a split existing ID3 tag (${chunked ? 'unknown' : 'known'} length)`, async () => {
    const input = writeMp3Id3v23Metadata(frames, { title: 'Old title', artist: 'Old artist' });
    let received: Buffer | undefined;
    const host = await fixture(async (req, res) => {
      if (req.method === 'GET') {
        res.writeHead(200, chunked ? {} : { 'content-length': input.length });
        for (let i = 0; i < input.length; i += 3) {
          res.write(input.subarray(i, i + 3));
          await new Promise(r => setTimeout(r, 1));
        }
        res.end();
        return;
      }
      const form = await multipart(req);
      const file = form.get('stationMedia') as File;
      assert.equal(file.name, 'master.mp3');
      assert.equal(file.type, 'audio/mpeg');
      received = Buffer.from(await file.arrayBuffer());
      json(res, { track: { id: 'track' } });
    });
    try {
      const result = await uploadMediaToRadioCult({
        mediaUrl: host.base + '/audio',
        fileName: 'master.mp3',
        metadata: { title: 'New title', artist: 'New artist' },
        apiBaseUrl: host.base,
        stationId: 'test',
        secretKey: 'test',
        deadline: performance.now() + 3000,
      });
      assert.equal(result.success, true, JSON.stringify(result));
      assert.deepEqual(
        received,
        writeMp3Id3v23Metadata(input, { title: 'New title', artist: 'New artist' })
      );
      assert.deepEqual(host.errors, []);
    } finally {
      host.close();
    }
  });
}

for (const retry of ['schedule', 'description', 'radiocult-503'] as const) {
  test(`${retry}: retry reopens the entire source and preserves metadata`, async () => {
    let downloads = 0;
    const uploads: FormData[] = [];
    const host = await fixture(async (req, res) => {
      if (req.url === '/art.jpg') {
        res.end('artwork');
        return;
      }
      if (req.method === 'GET') {
        downloads++;
        res.writeHead(200, { 'content-length': frames.length });
        res.end(frames);
        return;
      }
      uploads.push(await multipart(req));
      if (uploads.length === 1) {
        json(
          res,
          {
            error: {
              message: retry === 'schedule' ? 'Invalid publish_date' : 'description exceeds 1000',
            },
          },
          retry === 'radiocult-503' ? 503 : 400
        );
      } else
        json(res, retry === 'radiocult-503' ? { track: { id: 'track' } } : { key: '/test/show/' });
    });
    try {
      const input = {
        mediaUrl: host.base + '/audio',
        fileName: 'master.mp3',
        apiBaseUrl: host.base,
        deadline: performance.now() + 5000,
      };
      const result =
        retry === 'radiocult-503'
          ? await uploadMediaToRadioCult({
              ...input,
              stationId: 'test',
              secretKey: 'test',
              metadata: { title: 'Show' },
            })
          : await uploadMediaToMixcloud({
              ...input,
              title: 'Show',
              accessToken: 'test',
              description: 'a'.repeat(1500),
              imageUrl: host.base + '/art.jpg',
              hostsJson: '["@host", "second", "third"]',
              tagsJson: '["Jazz", "Soul"]',
              ...(retry === 'schedule'
                ? { broadcastDate: '2099-01-01', broadcastTime: '18:00', duration: '240' }
                : {}),
            });
      assert.equal(result.success, true, JSON.stringify(result));
      assert.equal(downloads, 2);
      assert.equal(uploads.length, 2);
      for (const form of uploads) {
        const audio = form.get(retry === 'radiocult-503' ? 'stationMedia' : 'mp3') as File;
        assert.deepEqual(
          Buffer.from(await audio.arrayBuffer()),
          retry === 'radiocult-503' ? writeMp3Id3v23Metadata(frames, { title: 'Show' }) : frames
        );
        if (retry !== 'radiocult-503') {
          assert.equal(form.get('hosts-0-username'), 'host');
          assert.equal(form.get('hosts-1-username'), 'second');
          assert.equal(form.has('hosts-2-username'), false);
          assert.equal(form.get('tags-0-tag'), 'Jazz');
          assert.equal(form.get('hide_stats'), '1');
          assert.equal(await (form.get('picture') as File).text(), 'artwork');
        }
      }
      if (retry === 'schedule') {
        assert.equal(uploads[0].get('publish_date'), '2099-01-01T22:00:00Z');
        assert.equal(uploads[1].has('publish_date'), false);
      }
      if (retry === 'description') {
        assert.equal(String(uploads[0].get('description')).length, 1000);
        assert.equal(String(uploads[1].get('description')).length, 900);
      }
      assert.deepEqual(host.errors, []);
    } finally {
      host.close();
    }
  });
}

for (const provider of ['Mixcloud', 'RadioCult'] as const) {
  for (const failure of [
    'source-stall',
    'source-truncated',
    'accepted-body-stall',
    'redirect',
  ] as const) {
    test(`${provider}: ${failure} stops without replaying the upload`, async () => {
      let posts = 0;
      let redirects = 0;
      const host = await fixture(async (req, res) => {
        if (req.url === '/redirect-target') {
          redirects++;
          json(res, {});
          return;
        }
        if (req.method === 'GET') {
          if (failure === 'source-stall') {
            res.writeHead(200, { 'content-length': 1000 });
            res.write(frames.subarray(0, 4));
            return;
          }
          res.writeHead(200, {
            'content-length': frames.length + (failure === 'source-truncated' ? 1000 : 0),
          });
          res.end(frames);
          return;
        }
        posts++;
        for await (const _chunk of req) {
          /* Consume the upload before responding. */
        }
        if (failure === 'redirect') {
          res.writeHead(307, { location: '/redirect-target' });
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write('{');
      });
      try {
        const input = {
          mediaUrl: host.base + '/audio',
          fileName: 'master.mp3',
          apiBaseUrl: host.base,
          deadline: performance.now() + 300,
        };
        const start = performance.now();
        const result =
          provider === 'Mixcloud'
            ? await uploadMediaToMixcloud({ ...input, title: 'Show', accessToken: 'test' })
            : await uploadMediaToRadioCult({ ...input, stationId: 'test', secretKey: 'test' });
        assert.equal(result.success, false);
        assert.ok(performance.now() - start < 1500);
        assert.equal(posts, failure === 'source-stall' ? 0 : 1);
        assert.equal(redirects, 0);
      } finally {
        host.close();
      }
    });
  }
}

async function verifyLargeTransfer(provider: 'Mixcloud' | 'RadioCult') {
  const size = Math.ceil(Number(process.env.WWFM_LARGE_UPLOAD_MIB || 128) * 1024 * 1024);
  const chunk = Buffer.alloc(64 * 1024, 0xab);
  chunk[0] = 0xff;
  chunk[1] = 0xfb;
  const tag = provider === 'RadioCult' ? buildId3v23Tag({ title: 'Show' })! : Buffer.alloc(0);
  const expected = createHash('sha256').update(tag);
  const actual = createHash('sha256');
  let fileRemaining = size + tag.length;
  let bytes = 0;
  let declared = 0;
  let peak = process.memoryUsage().rss;
  const monitor = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 5);
  const host = await fixture(async (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': size });
      for (let sent = 0; sent < size; ) {
        const part = chunk.subarray(0, Math.min(chunk.length, size - sent));
        expected.update(part);
        if (!res.write(part)) await once(res, 'drain');
        sent += part.length;
      }
      res.end();
      return;
    }
    declared = Number(req.headers['content-length']);
    let prefix = Buffer.alloc(0);
    let inFile = false;
    for await (const part of req) {
      bytes += part.length;
      let data: Buffer = part;
      if (!inFile) {
        prefix = Buffer.concat([prefix, data]);
        const offset = prefix.indexOf('\r\n\r\n');
        if (offset === -1) {
          assert.ok(prefix.length < 4096);
          continue;
        }
        assert.match(prefix.subarray(0, offset).toString(), /filename="master.mp3"/);
        data = prefix.subarray(offset + 4);
        inFile = true;
      }
      const length = Math.min(fileRemaining, data.length);
      if (length > 0) {
        actual.update(data.subarray(0, length));
        fileRemaining -= length;
      }
      // A slow consumer forces the source -> multipart -> socket path to respect backpressure.
      if (process.env.WWFM_SLOW_UPLOAD === '1') await new Promise(r => setTimeout(r, 1));
    }
    json(res, provider === 'Mixcloud' ? { key: '/test/show/' } : { track: { id: 'track' } });
  });
  try {
    const input = {
      mediaUrl: host.base + '/audio',
      fileName: 'master.mp3',
      apiBaseUrl: host.base,
      deadline: performance.now() + 60000,
    };
    const result =
      provider === 'Mixcloud'
        ? await uploadMediaToMixcloud({ ...input, title: 'Show', accessToken: 'test' })
        : await uploadMediaToRadioCult({
            ...input,
            metadata: { title: 'Show' },
            stationId: 'test',
            secretKey: 'test',
          });
    peak = Math.max(peak, process.memoryUsage().rss);
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(fileRemaining, 0);
    assert.equal(actual.digest('hex'), expected.digest('hex'));
    assert.equal(bytes, declared);
    assert.deepEqual(host.errors, []);
    console.info(
      JSON.stringify({
        provider,
        sourceMiB: size / 1024 / 1024,
        peakRssMiB: Math.round(peak / 1024 / 1024),
      })
    );
    assert.ok(
      peak < 450 * 1024 * 1024,
      `Peak RSS ${Math.round(peak / 1024 / 1024)} MiB exceeds the streaming budget`
    );
  } finally {
    clearInterval(monitor);
    host.close();
  }
}

for (const provider of ['Mixcloud', 'RadioCult'] as const) {
  test(`${provider}: large transfer has bounded memory, exact bytes, and backpressure`, () =>
    verifyLargeTransfer(provider));
}

test('concurrent large transfers remain bounded and preserve both files', async () => {
  await Promise.all([verifyLargeTransfer('Mixcloud'), verifyLargeTransfer('RadioCult')]);
});

for (const provider of ['Mixcloud', 'RadioCult'] as const) {
  test(`${provider}: retries a temporary source failure before starting one upload`, async () => {
    let downloads = 0;
    let posts = 0;
    const host = await fixture(async (req, res) => {
      if (req.method === 'GET') {
        downloads++;
        if (downloads === 1) {
          json(res, { error: 'temporary outage' }, 503);
          return;
        }
        res.writeHead(200, { 'content-length': frames.length });
        res.end(frames);
        return;
      }
      posts++;
      const form = await multipart(req);
      const file = form.get(provider === 'Mixcloud' ? 'mp3' : 'stationMedia') as File;
      assert.deepEqual(
        Buffer.from(await file.arrayBuffer()),
        provider === 'Mixcloud' ? frames : writeMp3Id3v23Metadata(frames, { title: 'Show' })
      );
      json(res, provider === 'Mixcloud' ? { key: '/test/show/' } : { track: { id: 'track' } });
    });
    try {
      const input = {
        mediaUrl: host.base + '/audio',
        fileName: 'master.mp3',
        apiBaseUrl: host.base,
        deadline: performance.now() + 5000,
      };
      const result =
        provider === 'Mixcloud'
          ? await uploadMediaToMixcloud({ ...input, title: 'Show', accessToken: 'test' })
          : await uploadMediaToRadioCult({
              ...input,
              stationId: 'test',
              secretKey: 'test',
              metadata: { title: 'Show' },
            });
      assert.equal(result.success, true, JSON.stringify(result));
      assert.equal(downloads, 2);
      assert.equal(posts, 1);
      assert.deepEqual(host.errors, []);
    } finally {
      host.close();
    }
  });
}
