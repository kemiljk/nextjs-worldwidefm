# Google Drive master archive

Upload Master can archive the master file to a Shared Drive in a `YYYY-MM` broadcast-month folder, in addition to Mixcloud and RadioCult. This feature is disabled by default. It is never used for host submission uploads.

To enable it, first create a Google Cloud service account, enable its Drive API and ask the client to grant that account permission to create folders and files in the Shared Drive location. Set these **server-only** deployment variables:

- `GOOGLE_DRIVE_ARCHIVE_ENABLED=true`
- `GOOGLE_DRIVE_MASTER_FOLDER_ID`: ID of the parent folder in the client's Shared Drive.
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`: the service account email.
- `GOOGLE_DRIVE_PRIVATE_KEY`: its private key, with actual newlines or literal `\n` characters.
- `GOOGLE_DRIVE_BLOB_HOST`: exact hostname of this project's public Vercel Blob store, without protocol.
- `GOOGLE_DRIVE_STAFF_SECRET`: a securely generated access key of at least 43 characters, for example the output of `openssl rand -base64 48`. Share it privately with staff using an appropriate password manager.

Never use `NEXT_PUBLIC_` for these values. The form asks for the staff access key while Drive is enabled, and verifies it with the server before the audio upload begins. The key is held only in the open page's memory and is sent only to the site's Drive endpoint, not to Google. The Google service account key never reaches the browser. The Drive endpoint remains disabled without all required configuration and a key of sufficient length. The existing upload endpoints do not yet have staff access control; this key only gates the new Drive endpoint.

The transfer streams the original temporary audio into a Google Drive resumable-upload session. It checks for a completed upload of the same episode and temporary Blob before starting another. Google Drive can return a stale listing after an interrupted upload, and concurrent first uploads can create duplicate month folders. The transfer selects a stable folder and checks all visible matching month folders for an existing file, but this is not an exactly-once guarantee; check the Drive folder before retrying an ambiguous result. When Drive fails, the Blob remains and the form offers a Drive-only retry without uploading to the other services again. If the page is closed, the retained audio URL must be kept by staff; this interface does not persist a recovery job. The Blob is only removed after Mixcloud, RadioCult, the episode update, and Drive all report success.

A real Shared Drive end-to-end test, including large files and interrupted transfers, remains necessary once credentials and a folder are available.

Google references: [Shared Drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives), [resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), and [service account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account).
