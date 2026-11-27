/**
 * Smoke test for the Google Drive master archive. Run it once the service account
 * has been added to the folder:
 *
 *   bun run scripts/test-google-drive-archive.ts
 *
 * It reads GOOGLE_DRIVE_MASTER_FOLDER_ID, GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL,
 * GOOGLE_DRIVE_PRIVATE_KEY and GOOGLE_DRIVE_BLOB_HOST from the environment or
 * .env.local (Bun loads it). It checks that the credentials work, that the folder
 * sits in a Shared Drive and is writable, then uploads a tiny text file and deletes
 * it again. Nothing else in the folder is touched.
 */
import { accessToken, getDriveMasterConfig } from '../lib/google-drive-master';

const FILES = 'https://www.googleapis.com/drive/v3/files';
const results: Array<[boolean, string]> = [];
const check = (ok: boolean, message: string) => {
  results.push([ok, message]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  return ok;
};

async function main() {
  const config = getDriveMasterConfig();
  if (!config) {
    console.error(
      'Missing config. Set GOOGLE_DRIVE_MASTER_FOLDER_ID, GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY and GOOGLE_DRIVE_BLOB_HOST.'
    );
    process.exit(1);
  }

  const signal = new AbortController().signal;
  let token: string;
  try {
    token = await accessToken(config, signal);
    check(true, 'Service account authenticates with Google');
  } catch (error) {
    check(false, `Service account authentication: ${(error as Error).message}`);
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${token}` };

  const folderResponse = await fetch(
    `${FILES}/${encodeURIComponent(config.folderId)}?supportsAllDrives=true&fields=id,name,mimeType,driveId,capabilities(canAddChildren)`,
    { headers }
  );
  if (
    !check(folderResponse.ok, `Folder is visible to the service account (${folderResponse.status})`)
  ) {
    console.error('Share the folder with the service account email as Content Manager.');
    process.exit(1);
  }
  const folder = (await folderResponse.json()) as {
    name?: string;
    mimeType?: string;
    driveId?: string;
    capabilities?: { canAddChildren?: boolean };
  };
  console.log(`      Folder name: ${folder.name}`);
  check(folder.mimeType === 'application/vnd.google-apps.folder', 'ID points at a folder');
  check(
    Boolean(folder.driveId),
    'Folder is inside a Shared Drive (service accounts cannot upload to My Drive)'
  );
  check(folder.capabilities?.canAddChildren === true, 'Service account can add files to it');

  const boundary = `wwfm-${Date.now()}`;
  const name = `wwfm-smoke-test-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: [config.folderId] }) +
    `\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\nWorldwide FM Drive smoke test. Safe to delete.\r\n--${boundary}--`;
  const upload = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  const uploaded = upload.ok ? ((await upload.json()) as { id?: string }) : {};
  check(Boolean(uploaded.id), `Test file uploaded (${upload.status})`);

  if (uploaded.id) {
    const removal = await fetch(`${FILES}/${uploaded.id}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers,
    });
    check(removal.ok, `Test file deleted again (${removal.status})`);
  }

  const failed = results.filter(([ok]) => !ok).length;
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed. Drive is ready.');
  process.exit(failed ? 1 : 0);
}

void main();
