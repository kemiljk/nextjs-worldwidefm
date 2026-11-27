# Website feedback sheet — rows 92–106 (30 Oct onwards)

Source: Google Sheet "Website" tab (collapsed rows ignored). Verified against `main` @ d6e3996, 27 Nov 2026.

## Already done in code (sheet still says Not Completed)

- [x] R92 editorial/video caption layout — 6ed6b6b (standard layout full-width text) + 79c12f1 (`VideoCaption`)
- [x] R93 homepage editorial/video curation — `sections` objects (type Editorial/Videos) render in `page_order`
- [x] R94 "More in X" genre mismatch — `getRelatedEpisodes` returns the matched `genreId`
- [x] R95 live red dot — `components/live-player.tsx`
- [x] R96 stay logged in — 400-day renewable sessions (`lib/member-session.ts`)
- [x] R97 Hosts & Series first in search — `search-dialog.tsx`
- [x] R98 "Saved to queue" for upcoming shows — replaced by `EpisodeReminderButton`
- [x] R99 Friday Curates -> series — migration applied 11 Nov (0 episodes still typed Friday Curates)
- [x] R100 video captions under categories/videos — `video-categories.description` + `VideoCaption`
- [x] R101 coloured sections by metafield — `episodes` / `hosts` repeater fields

## To build

- [x] R102 Hide the LIVE dot when no real show is on air (playlist / unknown state)
- [x] R103 Stop forcing uppercase on text the user types (Input/Textarea) so case matches the back end
- [x] R105 Schedule shows a rolling 7 days starting today (not Mon–Sun)
- [x] R106 Schedule plain-text placeholder entries that yield to a published episode in the same slot
- [x] R104 Upload Master: queue several shows in one tab, sequential uploads, per-show status

## Review

- R102: `lib/live-status.ts` decides "on air"; the red dot only renders for a scheduled show or a non-playlist programme. Unit + e2e covered.
- R103: `Input`, `Textarea` and `CommandInput` no longer upper-case typed text (placeholders stay upper-case). This is site-wide, not only the submission form, because the add-host/artist dialogs render in portals.
- R105: `getRollingUkWeek` (today + 6) drives `getWeeklySchedule`; items sort by date; the page renders `dayOrder`. Weekly templates in Cosmic still map by weekday name.
- R106: schedule entries with `placeholder_title` and no episode show until a published episode starts inside their slot (default 1 h). `scripts/add-schedule-placeholder-field.ts` adds the Cosmic fields (dry run by default, NOT applied).
- R104: `UploadMasterForm` is now a list of per-show jobs with one shared upload lock, an "Upload N ready" sequential queue (`lib/upload-master-queue.ts`), per-show status/result and a leave-page warning. The upload flow itself is unchanged (`bun run verify:upload-master` passes 8/8).
- Verification: 46/46 unit suites; new e2e (live player, queue x3, form case) pass in Chromium; `next build` passes.
- Pre-existing failures (also fail on untouched code): `form-rendering` "renders after browser hydration" x2 (networkidle never settles with the 100 ms live poll) and `upload-master.spec` "keeps the selected show and file visible" (two `role=status` regions).
- `bun install` was needed after the pull (zod 4 in package.json, 3.25 installed).

## Round 2 — earlier open rows

- [x] R66 Video captions as rich text: `lib/rich-text.ts` (safe parser, no HTML injection) + `VideoCaption`; plain-text captions unchanged; SEO description stripped to plain text. Schema script `update-video-description-field.ts` (not applied).
- [x] R82 Host names in show copy link to Instagram (`lib/link-host-names.ts`, underlined). Only 1 of 399 hosts has an Instagram value, so this needs data entry.
- [x] R84 Homepage "Listen by location" block (`components/location-selector.tsx`, opt-in via `location-selector` block type, script updated, not applied). Checked in a browser against real Cosmic data.
- [x] R72 Mixcloud host tags: username normalisation (`@`, links), post-publish verification in the publisher cron, `audit-mixcloud-hosts.ts`. Finding: 108 of 111 hosts on shows in the last 120 days have no `mixcloud_username`.
- [x] R83 Membership page blocks (`lib/membership-blocks.ts`, `components/membership-blocks.tsx`); schema script `add-membership-blocks-field.ts` (not applied).
- [x] R75 Dropped: the client sorted it with "Sort by Date" on the episode page, so no title changes or backfill were made.
- Not done (need input): R69/R70 Drive intake, R71 Drive config, R76 member insights (staff access decision), R80 corrected copy, R99 leftovers.
- Verification: 51/51 unit suites, `tsc --noEmit` clean, ESLint 0 errors, `next build` passes.
- Playwright was NOT re-run after the final edits: a preview dev server I started (PID 73162, port 3100) blocks Playwright's own server and stopping it was denied.

---

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
