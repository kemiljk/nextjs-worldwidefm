import { describe, expect, it } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import {
  archiveMasterToDrive,
  broadcastMonth,
  validateMasterBlobUrl,
} from '@/lib/google-drive-master';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const config = {
  folderId: 'shared-root',
  serviceAccountEmail: 'test@example.iam.gserviceaccount.com',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  blobHost: 'ours.public.blob.vercel-storage.com',
};
const input = {
  blobUrl: 'https://ours.public.blob.vercel-storage.com/media/master.mp3',
  fileName: 'master.mp3',
  broadcastDate: '2026-10-31',
  episodeId: 'episode-1',
  config,
};

describe('Google Drive master archive', () => {
  it('uses broadcast month and rejects invalid dates and untrusted audio URLs', () => {
    expect(broadcastMonth('2026-10-31')).toBe('2026-10');
    expect(() => broadcastMonth('2026-02-29')).toThrow();
    expect(() =>
      validateMasterBlobUrl(
        'https://ours.public.blob.vercel-storage.com.evil.test/media/a',
        config.blobHost
      )
    ).toThrow();
    expect(() =>
      validateMasterBlobUrl('https://ours.public.blob.vercel-storage.com/other/a', config.blobHost)
    ).toThrow();
  });

  it('streams the original audio into the broadcast-month folder', async () => {
    const original = globalThis.fetch;
    const calls: string[] = [];
    let received = '';
    globalThis.fetch = (async (target: RequestInfo | URL, options?: RequestInit) => {
      const url = String(target);
      calls.push(url);
      if (url === 'https://oauth2.googleapis.com/token')
        return Response.json({ access_token: 'token' });
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?') && !options?.method) {
        const q = new URL(url).searchParams.get('q') || '';
        return Response.json({
          files: q.includes('mimeType') ? [{ id: 'month-folder', name: '2026-10' }] : [],
        });
      }
      if (url === input.blobUrl)
        return new Response('original audio', {
          headers: { 'content-length': '14', 'content-type': 'audio/mpeg' },
        });
      if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) {
        expect(JSON.parse(String(options?.body))).toMatchObject({
          name: 'master.mp3',
          parents: ['month-folder'],
        });
        return new Response(null, {
          headers: { location: 'https://www.googleapis.com/upload/session-1' },
        });
      }
      if (url === 'https://www.googleapis.com/upload/session-1') {
        for await (const chunk of options?.body as any) received += Buffer.from(chunk).toString();
        return Response.json({ id: 'master-id' });
      }
      throw new Error(`Unexpected request ${url}`);
    }) as typeof fetch;
    try {
      expect(await archiveMasterToDrive(input)).toEqual({
        fileId: 'master-id',
        month: '2026-10',
        alreadyArchived: false,
      });
      expect(received).toBe('original audio');
      expect(calls.some(call => call.includes('supportsAllDrives=true'))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('returns a previously completed upload without retransmitting the audio', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (target: RequestInfo | URL) => {
      const url = String(target);
      if (url === 'https://oauth2.googleapis.com/token')
        return Response.json({ access_token: 'token' });
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
        const q = new URL(url).searchParams.get('q') || '';
        return Response.json({
          files: q.includes('mimeType')
            ? [{ id: 'month-folder', name: '2026-10' }]
            : [{ id: 'existing-master', name: 'master.mp3' }],
        });
      }
      throw new Error(`Unexpected request ${url}`);
    }) as typeof fetch;
    try {
      expect(await archiveMasterToDrive(input)).toEqual({
        fileId: 'existing-master',
        month: '2026-10',
        alreadyArchived: true,
      });
    } finally {
      globalThis.fetch = original;
    }
  });
});

it('finds existing masters across duplicate month folders created concurrently', async () => {
  const original = globalThis.fetch;
  let query = '';
  globalThis.fetch = (async (target: RequestInfo | URL) => {
    const url = String(target);
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({ access_token: 'token' });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      const q = new URL(url).searchParams.get('q') || '';
      if (q.includes('mimeType'))
        return Response.json({
          files: [
            { id: 'z-folder', name: '2026-10' },
            { id: 'a-folder', name: '2026-10' },
          ],
        });
      query = q;
      return Response.json({ files: [{ id: 'already-uploaded', name: 'master.mp3' }] });
    }
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  try {
    expect(await archiveMasterToDrive(input)).toEqual({
      fileId: 'already-uploaded',
      month: '2026-10',
      alreadyArchived: true,
    });
    expect(query).toContain("'a-folder' in parents or 'z-folder' in parents");
  } finally {
    globalThis.fetch = original;
  }
});

it('selects a stable month folder after a concurrent folder creation', async () => {
  const original = globalThis.fetch;
  let folderQueries = 0;
  let chosenParent = '';
  globalThis.fetch = (async (target: RequestInfo | URL, options?: RequestInit) => {
    const url = String(target);
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({ access_token: 'token' });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?') && !options?.method) {
      const q = new URL(url).searchParams.get('q') || '';
      if (q.includes('mimeType'))
        return Response.json({
          files:
            ++folderQueries === 1
              ? []
              : [
                  { id: 'a-folder', name: '2026-10' },
                  { id: 'z-folder', name: '2026-10' },
                ],
        });
      return Response.json({ files: [] });
    }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?') && options?.method === 'POST')
      return Response.json({ id: 'z-folder' });
    if (url === input.blobUrl) return new Response('audio', { headers: { 'content-length': '5' } });
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) {
      chosenParent = JSON.parse(String(options?.body)).parents[0];
      return new Response(null, {
        headers: { location: 'https://www.googleapis.com/upload/session-2' },
      });
    }
    if (url === 'https://www.googleapis.com/upload/session-2') {
      for await (const _chunk of options?.body as any) {
        /* drain */
      }
      return Response.json({ id: 'master-id' });
    }
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  try {
    await archiveMasterToDrive(input);
    expect(chosenParent).toBe('a-folder');
  } finally {
    globalThis.fetch = original;
  }
});
