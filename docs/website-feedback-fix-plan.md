# WWFM Website Feedback — Fix Plan

Source: `WWFM Website Feedback.xlsx` (Website tab rows 19, 38, 44, 61–92; App tab is all complete).
Assessed against `main` @ 319bb3e, 23 Oct 2026. Sizes: S ≈ <½ day, M ≈ 1–2 days, L ≈ 3+ days.

## Summary

37 open items. They collapse into a handful of root causes:

1. **Curation is mostly built but unused** — homepage `sections`, `heroItems`, `archive_shows` and the block marker types exist in Cosmic, but the marker objects were never created and editors don't know about the fields. Several "can't curate" items are a content/training fix.
2. **`player` is the only "archived" signal** — it's written the moment Mixcloud accepts the upload, before the scheduled publish, so Listen Back appears early and links to a 404 on Mixcloud.
3. **The weekly show cron is a thin write-once copier** — wrong fields (`description`/`external_image_url` instead of `body_text`/`image`), no HTML conversion, no category/location/genre, hard-coded copy, never refreshes drafts.
4. **No draft preview** — editorial page ignores `?preview`, no `draftMode`, so drafts 404.
5. **No Google Drive integration** — RadioCult is the only audio sink.
6. **Staff tooling is thin and unauthenticated** — `/staff`, `/add-show`, `/api/export-shows` have no auth gate at all.

---

## Phase 0 — Content & config only (no code, do first)

Tell the team these are available today; walk them through it.

| Item | Action |
|---|---|
| R44 Curate homepage shows | Create a `sections` object, type **Shows**, pick episodes, add to homepage `page_order`. |
| R69 / R87 Position video + archive sections | Create one object each of `video-block`, `archive-block`, `genre-selector`, `editorial-block` so they can be dragged into `page_order`. Fill `homepage.archive_shows` to curate "From the Archive". |
| R86 Non-show hero items | `heroItems` already accepts any type (after the host bug fix in Phase 1). |
| R62 "Other" section on editorial | Add **Festivals** and **Programme Announcements** to Editorial Page Config → Category Order. Posts in unlisted categories fall into "Other". |
| R65 Reorder video rows | Already possible via Videos Page Config → Category Order. |
| R80 Placeholder copy | Get corrected copy from the client (also see Phase 2). |
| R90 Overnight replays | Radio programming — schedule replays/auto-rotation in RadioCult. The site relays whatever RadioCult broadcasts. |
| R72 Mixcloud host tagging (part) | Client to fill `mixcloud_username` on hosts and confirm each host has accepted the WWFM account's host invite in Mixcloud. |

## Phase 1 — Quick code fixes (S each)

- **Auth gate for staff tools** — add middleware/proxy protecting `/staff/*`, `/add-show`, `/api/export-shows` (and anything new in Phase 5). Prerequisite for any member-data page.
- **R86** Hero filters out host pages: `app/page.tsx:370` and `components/homepage-hero.tsx` use `'hosts'`; the type is `regular-hosts`. Add a YouTube thumbnail fallback for video hero items.
- **R67 / R69** `renderPageOrderItem` (`app/page.tsx:174`) silently drops content objects put straight into `page_order` (one `videos` object is there now). Render them as single-feature blocks. Have the default video block honour `featured_on_homepage` (5 videos have it set; code ignores it).
- **R92 leftovers** — 319bb3e filtered Latest Shows, but Featured (`app/page.tsx:192,478`), genre picks and the random archive fallback still use the unfiltered query. Pass `listenBackOnly` there too.
- **R74** Tracklist blank lines — `htmlTracklistToPlainText` (`app/update-tracklist/update-tracklist-form.tsx:33`) keeps Cosmic's literal newlines between `<p>`s; save path maps every `\n` to `<br />`. One shared plain↔HTML tracklist helper used by the form, `app/api/episodes/[id]/tracklist/route.ts` and `add-show-form.tsx`, dropping empty lines.
- **R73 leftovers** — 375f7a8 already swapped the tracklist for a show-page link. Remaining leak: Mixcloud description uses `body_text || description`, and submitters paste tracklists into body text. Prefer `description`; relabel "Tracklist:" link. Confirm the client is testing post-21-Sep uploads.
- **R68** Link video categories to `/videos?categories=…` (filter already exists).
- **R65** Carousel arrows are `hidden sm:flex` and only shown for >3 items — show controls/peek at all sizes.
- **R19** Social icons in the navbar (shared cached fetch of `social-links`). Confirm: header *as well as* footer, or instead?

## Phase 2 — Show pipeline correctness

- **R91 / R89 Listen Back before Mixcloud publish (M)** — write the Mixcloud URL to a pending field (`mixcloud_pending_url`, `mixcloud_publish_at`) instead of `player`. Cron (~15 min) checks the cloudcast is live, then promotes to `player`/`page_link` and revalidates. Remove the duplicate client-side write in `lib/upload-master-flow.ts:154`. Also tighten `lookupMixcloudCloudcastUrl`'s "newest cloudcast" fallback, which can save the wrong URL.
- **Weekly showpages rework (M) — R78, R79, R80, R81**, in `lib/create-weekly-shows.ts` / `lib/recurring-shows.ts`:
  - Write copy to `body_text` (converted plain-text → `<p>`/`<br>` to keep paragraphs) — R78, R79.
  - Set `image` from the host's Cosmic media; only use `external_image_url` when the host image is cold-stored (that field is the cold-storage mechanism, so don't remove it globally) — R78.
  - Copy type, locations and genres from the host's latest published episode — R81.
  - Move templates out of code into a Cosmic `recurring-show` type so copy is editable; rerun `repair-recurring-episodes.ts` on existing drafts — R80.
- **R82 Host → Instagram links (M)** — add `instagram` metafield to `regular-hosts`; wrap host names in show copy with links; add link underline styling to the episode body. Confirm: Instagram, or the host page on the site?
- **R72 Mixcloud host tagging (S–M)** — warn in the form when a selected host has no `mixcloud_username`; verify hosts on the created cloudcast and log mismatches; `getCosmicHosts` only loads published hosts capped at 1000.
- **R88 Series shows visible before broadcast (S–M)** — add an "Upcoming" rail on host/series pages (`broadcast_date >= today`); fix `> today` → `>= today` for "This Week". Weekly cron drafts stay hidden until published. Confirm: upcoming rail only, or in the main grid too?
- **R38 Manual schedule entries not linking (M)** — a manual schedule entry blocks the automatic episode for the slot (`lib/schedule-days.ts`) and links only its fixed `episode_link`. Fall back to matching the published episode on the same date/slot. Need a screenshot of what "Ongoing" is in Cosmic.

## Phase 3 — Editor tooling

- **R64 / R63 Draft preview + shareable preview (S–M)** — `/api/preview?secret=…&slug=…` enabling `draftMode`; editorial (and episode) page fetch with `includeDrafts` when on, uncached. Update Cosmic `preview_link`s. The preview URL is then shareable.
- **Video presentation (S–M) — R85, R66**:
  - Shared thumbnail facade: show `image` (or YouTube thumbnail) with play button; click loads the iframe, or links out when an "age restricted / open on YouTube" switch is on. Relabel `image` as "Thumbnail".
  - `videos.description` → rich text (`html-textarea`), rendered via `lib/sanitize-html.ts`, left-aligned body style.
  - Collapse the three duplicated `getYouTubeThumbnail` helpers.
- **R61 Editorial page layout (M–L)** — give the editorial page the homepage's `page_order` block model.
- **R83 Membership page blocks (M)** — `blocks` field on `memberships` (image+copy, CTA, gallery, FAQ) and a block renderer. Same renderer as R61.
- **R84 Location search on homepage (M)** — a location-selector homepage block (mode of `GenreSelector` or a new marker type). Pairs with the map idea below.

## Phase 4 — Google Drive audio (M–L, needs client setup)

- **R70** Submissions → Drive instead of RadioCult: `lib/google-drive.ts` (service account), stream Blob → Drive resumable upload, store `drive_file_id` on the episode, delete Blob.
- **R71** Master Upload → also archive to Drive under a `YYYY-MM` broadcast-month folder, as a third destination in `upload-master-flow.ts`; only clean up the Blob if all destinations succeed.
- Prerequisites from client: a **Shared Drive** (service accounts have no My Drive quota) with the service account as Content Manager; folder IDs and naming; whether RadioCult is dropped entirely for submissions; who gets notified.

## Phase 5 — Back-end / staff tooling

- **R77 Host/series shows at a glance (S)** — "View shows" table on the existing `/staff/export-shows` page (query already exists). Also check whether Cosmic's dashboard shows connected objects for `regular_hosts`.
- **R75 Dates in episode titles (M)** — store titles as "Luke Una – 06.10.2026" in both create paths, strip the suffix for display (or add `display_title`), switch cron dedup to slug, backfill script with dry-run. Slugs unchanged.
- **R76 Member insights (M)** — `/staff/members`: top favourited genres/hosts, most-saved shows, members by subscription status, CSV export. Data is already on Cosmic `users`. Requires the auth gate.

---

## Roadmap — from internal notes

| Idea | Fit | Notes |
|---|---|---|
| **Live player buffering/glitching** | New, M | `components/live-player.tsx` uses `preload='none'` and only handles hard `error` events — no `stalled`/`waiting` handling or auto-reconnect, which matches the glitch reports. Add stall detection + reconnect with backoff, warm the connection on hover/focus of the play button, and reload the stream on `visibilitychange` / audio-focus regain. Test on the streaming-issue-log browsers (Safari macOS, old iOS Safari). "Play from memory" in the live sense = keep a warm connection, not caching. |
| **CMS audit script (missing tracklists/hosts/locations)** | New, S–M; feeds R81 | Read-only `scripts/audit-episodes.ts`: report episodes missing `tracklist`, `regular_hosts`, `locations`, `genres`, `type`, image, `player`. Then a repair mode that pulls hosts/locations/genres from sibling episodes with the same host/title (same logic as the weekly cron fix). |
| **Favourites dashboard / targeting** | = R76 | Build R76 first; then use favourite genres/hosts for For You weighting and segmented emails (Resend). Check privacy/consent copy before targeting. |
| **Map-based discovery** | New, M–L; pairs with R84 | `locations` have no coordinates. One-off geocoding script to add lat/lng metafields, then a `/explore` map (MapLibre + free tiles) linking to `/shows?location=`. |
| **"Stuck if I don't like the live show"** | UX, S–M | Add "Not feeling it? Try…" next to the live player: genre-matched archive picks, upcoming-today, random-from-archive. Reuses genre selector + R84/map. |
| **Android app by end of month** | Risky | ~8 days left. An agent can port the screens quickly, but background audio (media session/foreground service), testing on real devices and Play Store review (new developer accounts need a closed test period before production) make a public release by 31 Oct unrealistic. Realistic goal: internal test build by end of month, public release later. Decide native Kotlin/Compose vs a shared cross-platform codebase first. |
| **Cheap deep storage** | Partly exists | Cold-storage cron already moves old *images* from Cosmic to Vercel Blob (`docs/cold-storage-migration.md`). Audio is the real cost and is now planned for Drive (Phase 4) — that's the natural archive tier. Episode *objects* are cheap text; no need to move them. Revisit Blob cost vs R2/B2 if image volume grows. |

## Also spotted (not in the sheet)

- `posts.type` options in Cosmic are Compact/Wide, but code expects `article`/`video` — the editorial Article/Video filters and video-post layout may never trigger.
- `docs/show-submission-flow.md` references a `/api/cron/sync-episodes` route that doesn't exist.

## Questions for the client

1. R19: social icons in header *instead of* or *as well as* the footer?
2. R82: host names link to Instagram or to the host page on the site?
3. R88: future shows in an "Upcoming" section only, or in the main archive grid too?
4. R38: what is "Ongoing" in Cosmic? (screenshot of the schedule object)
5. R70/71: Shared Drive + folder structure; drop RadioCult for submissions entirely?
6. R80: corrected placeholder copy for each recurring show.
7. R72: confirm hosts have accepted Mixcloud host invites; is a 2-host cap OK?

## Suggested order

Phase 0 (this week, with a short walkthrough for editors) → Phase 1 → Phase 2 (R91/R89 first — it's user-visible breakage) → Phase 3 preview (R64) → rest of Phase 3 → Phase 5 → Phase 4 once the Drive setup is in place. Live player stability can run in parallel with Phase 2.
