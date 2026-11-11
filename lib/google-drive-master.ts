import { createHash, createSign } from 'node:crypto';
import { openUploadAudio } from '@/lib/upload-audio-stream';
import { remainingUploadTime, withUploadTimeout } from '@/lib/upload-fetch';
import { UPLOAD_BLOB_FETCH_TIMEOUT_MS, UPLOAD_PROVIDER_TIMEOUT_MS } from '@/lib/upload-config';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FOLDER_TYPE = 'application/vnd.google-apps.folder';

export interface DriveMasterConfig {
  folderId: string;
  serviceAccountEmail: string;
  privateKey: string;
  /** Exact hostname of this project's temporary public Blob store. */
  blobHost: string;
}

export function getDriveMasterConfig(): DriveMasterConfig | null {
  const folderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID?.trim();
  const serviceAccountEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const blobHost = process.env.GOOGLE_DRIVE_BLOB_HOST?.trim().toLowerCase();
  if (!folderId || !serviceAccountEmail || !privateKey || !blobHost) return null;
  return { folderId, serviceAccountEmail, privateKey, blobHost };
}

function queryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function broadcastMonth(date: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) throw new Error('Invalid broadcast date');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new Error('Invalid broadcast date');
  return date.slice(0, 7);
}

export function validateMasterBlobUrl(value: string, blobHost: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid audio URL');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== blobHost.toLowerCase() ||
    !blobHost.endsWith('.public.blob.vercel-storage.com') ||
    url.username ||
    url.password ||
    url.port ||
    !url.pathname.startsWith('/media/')
  ) {
    throw new Error('Audio must be a temporary file from the configured Blob store');
  }
}

async function accessToken(config: DriveMasterConfig, signal: AbortSignal): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: config.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(config.privateKey).toString('base64url')}`;
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    signal,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status})`);
  const json = (await response.json()) as { access_token?: unknown };
  if (typeof json.access_token !== 'string')
    throw new Error('Google authentication returned no token');
  return json.access_token;
}

async function listFiles(
  query: string,
  token: string,
  signal: AbortSignal
): Promise<Array<{ id: string; name: string }>> {
  const params = new URLSearchParams({
    q: query,
    fields: 'nextPageToken,files(id,name)',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const response = await fetch(`${DRIVE_API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google Drive lookup failed (${response.status})`);
  const json = (await response.json()) as {
    files?: Array<{ id: string; name: string }>;
    nextPageToken?: string;
  };
  if (!Array.isArray(json.files) || json.nextPageToken)
    throw new Error('Google Drive lookup returned an ambiguous result');
  return json.files;
}

async function monthlyFolders(
  parentId: string,
  month: string,
  token: string,
  signal: AbortSignal
): Promise<string[]> {
  const q = `'${queryLiteral(parentId)}' in parents and name = '${month}' and mimeType = '${FOLDER_TYPE}' and trashed = false`;
  const folders = await listFiles(q, token, signal);
  if (folders.length) return folders.map(folder => folder.id).sort();
  const response = await fetch(`${DRIVE_API}?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    signal,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: month, mimeType: FOLDER_TYPE, parents: [parentId] }),
  });
  if (!response.ok)
    throw new Error(`Could not create Google Drive month folder (${response.status})`);
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error('Google Drive did not confirm the month folder');
  // Simultaneous first uploads can each create a folder. Include both our own
  // ID and whatever Drive already lists, then choose a stable canonical ID.
  const visible = await listFiles(q, token, signal);
  return [...new Set([data.id, ...visible.map(folder => folder.id)])].sort();
}

/** Server-only transfer primitive. Call only after staff authorisation and configuration. */
export async function archiveMasterToDrive(input: {
  blobUrl: string;
  fileName: string;
  broadcastDate: string;
  episodeId: string;
  config: DriveMasterConfig;
  signal?: AbortSignal;
}): Promise<{ fileId: string; month: string; alreadyArchived: boolean }> {
  const { config } = input;
  validateMasterBlobUrl(input.blobUrl, config.blobHost);
  const month = broadcastMonth(input.broadcastDate);
  if (!input.episodeId || !input.fileName.trim() || /[\x00-\x1f/\\]/.test(input.fileName))
    throw new Error('Invalid episode or file name');
  const deadline = performance.now() + UPLOAD_PROVIDER_TIMEOUT_MS;
  return withUploadTimeout(
    async signal => {
      const token = await accessToken(config, signal);
      const folderIds = await monthlyFolders(config.folderId, month, token, signal);
      const folderId = folderIds[0];
      // The same temporary blob and episode identify a retry, without exposing the URL in Drive.
      const sourceKey = createHash('sha256')
        .update(`${input.episodeId}\n${input.blobUrl}`)
        .digest('hex');
      // Search every same-month folder, including folders created concurrently,
      // so a retry can find a master outside the currently canonical folder.
      const parents = folderIds.map(id => `'${queryLiteral(id)}' in parents`).join(' or ');
      const q = `(${parents}) and appProperties has { key='wwfmMaster' and value='${sourceKey}' } and trashed = false`;
      const existing = await listFiles(q, token, signal);
      if (existing.length > 1)
        throw new Error(
          'Multiple matching Google Drive masters exist; check the folder before retrying'
        );
      if (existing.length === 1) return { fileId: existing[0].id, month, alreadyArchived: true };
      const audio = await openUploadAudio({
        mediaUrl: input.blobUrl,
        deadline,
        readTimeoutMs: UPLOAD_BLOB_FETCH_TIMEOUT_MS,
        signal,
      });
      try {
        if (audio.size === undefined || audio.size <= 0)
          throw new Error('Audio size is unavailable');
        const response = await fetch(
          `${DRIVE_UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id`,
          {
            method: 'POST',
            signal,
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Upload-Content-Type': audio.contentType,
              'X-Upload-Content-Length': String(audio.size),
            },
            body: JSON.stringify({
              name: input.fileName,
              parents: [folderId],
              appProperties: { wwfmMaster: sourceKey },
            }),
          }
        );
        if (!response.ok)
          throw new Error(`Could not start Google Drive upload (${response.status})`);
        const session = response.headers.get('location');
        if (!session) throw new Error('Google Drive did not return an upload session');
        const sessionUrl = new URL(session);
        if (
          sessionUrl.protocol !== 'https:' ||
          !['www.googleapis.com', 'upload.googleapis.com'].includes(sessionUrl.hostname)
        )
          throw new Error('Google Drive returned an unexpected upload location');
        const stream = audio.stream([]);
        const upload = await fetch(sessionUrl, {
          method: 'PUT',
          signal,
          cache: 'no-store',
          headers: { 'Content-Type': audio.contentType, 'Content-Length': String(audio.size) },
          body: stream as unknown as BodyInit,
          duplex: 'half',
        } as RequestInit & { duplex: 'half' });
        if (!upload.ok)
          throw new Error(
            `Google Drive upload did not complete (${upload.status}); check the folder before retrying`
          );
        const result = (await upload.json()) as { id?: string };
        if (!result.id) throw new Error('Google Drive did not confirm the uploaded file');
        return { fileId: result.id, month, alreadyArchived: false };
      } finally {
        await audio.close();
      }
    },
    remainingUploadTime(deadline),
    input.signal
  );
}
