# Upload master form investigation

- [x] Confirm worktree state and fast-forward `main` from `origin/main`.
- [x] Map the upload-master UI, submission handler, API/server action, and storage/CMS calls.
- [x] Reproduce or isolate the refresh after the “preparing upload” stage.
- [x] Identify the regression window and root cause, including why multiple shows are affected.
- [x] Implement the smallest durable fix with clear failure handling.
- [x] Add targeted regression coverage.
- [x] Run relevant tests, type checks, lint/build checks, and review the final diff.
- [x] Document investigation evidence and verification results below.

## Review

- `main` fast-forwarded from `5fd9744` to `349e000`; no upload code changed after the
  form was known to work on Thursday 20 August.
- Production logs for three 24 August attempts show Blob token `200`, Mixcloud `400`,
  RadioCult `200`, and Cosmic archive `200`. There was no page request after completion,
  so the apparent refresh was the client clearing its fields after partial success.
- The warning explaining the partial result was invisible because Sonner had no mounted
  toaster. Progress phases after Blob were also set only after the whole flow returned.
- The exact Mixcloud validation response was not retained in production logs. The account,
  token, Pro status, MP3 decode/size, artwork, description, tags, and hosts checked out;
  `publish_date` is the strongest remaining upstream suspect. Sanitized 4xx logging was
  added so a recurrence records the exact field.
- Total destination failure no longer performs/counts a host-only archive PATCH, so the
  selected show and file remain available and the raw Blob is kept.
- Verification: 110 unit tests pass; 3 Chromium upload-master E2E tests pass; touched-file
  ESLint and Prettier checks pass; production build passes. Repository-wide `tsc --noEmit`
  still reports existing errors in videos, nav, homepage actions, and a recurring-host script.
