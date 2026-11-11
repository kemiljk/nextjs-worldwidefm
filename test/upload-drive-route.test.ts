import { beforeAll, afterAll, describe, expect, it, mock } from 'bun:test';

let archives = 0;
mock.module('@/lib/google-drive-master', () => ({
  getDriveMasterConfig: () => ({
    folderId: 'folder',
    serviceAccountEmail: 'staff@example.com',
    privateKey: 'secret',
    blobHost: 'store.public.blob.vercel-storage.com',
  }),
  archiveMasterToDrive: async () => {
    archives++;
    return { fileId: 'file', month: '2026-10', alreadyArchived: false };
  },
}));
import { POST } from '@/app/api/upload-drive/route';

const key = 'a'.repeat(64);
const previous = {
  enabled: process.env.GOOGLE_DRIVE_ARCHIVE_ENABLED,
  key: process.env.GOOGLE_DRIVE_STAFF_SECRET,
};
beforeAll(() => {
  process.env.GOOGLE_DRIVE_ARCHIVE_ENABLED = 'true';
  process.env.GOOGLE_DRIVE_STAFF_SECRET = key;
});
afterAll(() => {
  if (previous.enabled === undefined) delete process.env.GOOGLE_DRIVE_ARCHIVE_ENABLED;
  else process.env.GOOGLE_DRIVE_ARCHIVE_ENABLED = previous.enabled;
  if (previous.key === undefined) delete process.env.GOOGLE_DRIVE_STAFF_SECRET;
  else process.env.GOOGLE_DRIVE_STAFF_SECRET = previous.key;
});
function request(token: string, body: object) {
  return new Request('https://www.worldwidefm.net/api/upload-drive', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('Drive staff gate', () => {
  it('rejects unauthorised archive and does not call Drive', async () => {
    const res = await POST(
      request('wrong', { blobUrl: 'x', fileName: 'x', broadcastDate: '2026-10-01', episodeId: 'x' })
    );
    expect(res.status).toBe(401);
    expect(archives).toBe(0);
  });
  it('accepts a valid preflight and authorised archive', async () => {
    expect((await POST(request(key, { action: 'check' }))).status).toBe(200);
    expect(
      (
        await POST(
          request(key, { blobUrl: 'x', fileName: 'x', broadcastDate: '2026-10-01', episodeId: 'x' })
        )
      ).status
    ).toBe(200);
    expect(archives).toBe(1);
  });
  it('fails closed if the archive is disabled or the key is weak', async () => {
    process.env.GOOGLE_DRIVE_ARCHIVE_ENABLED = 'false';
    expect((await POST(request(key, { action: 'check' }))).status).toBe(503);
    process.env.GOOGLE_DRIVE_ARCHIVE_ENABLED = 'true';
    process.env.GOOGLE_DRIVE_STAFF_SECRET = 'short';
    expect((await POST(request('short', { action: 'check' }))).status).toBe(503);
    process.env.GOOGLE_DRIVE_STAFF_SECRET = key;
  });
});
