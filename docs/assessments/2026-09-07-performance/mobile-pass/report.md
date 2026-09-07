# Mobile performance pass — 7 September 2026

This pass follows the [second assessment](../second-pass/report.md). Changes are implemented locally, with no push or deployment. The user's mobile-majority audience estimate has not been checked against analytics.

## Results

Under the same mobile lab conditions, homepage LCP fell from **8.0 seconds to 2.1 seconds**. Intermediate/final samples were 2.21, 2.08 and 2.11 seconds. Initial homepage image traffic fell from **1.14 MB to 204 KB**, about 82% less. The loaded homepage looks the same; artwork quality was visually checked on the captured high-DPR mobile screenshots.

| Mobile route | Final LCP | Final CLS | Interpretation |
| --- | ---: | ---: | --- |
| Homepage | 2.11 s | 0.014 | Primary hero loaded at 2.09 s; second visible hero at 3.43 s |
| Shows | 1.40 s | 0 | The large decorative header is LCP; card image completion is tracked separately |
| Example episode | 1.36 s | 0 | Both foreground artwork and backdrop finish from one image request at 1.34 s |

The episode originally took 5.85 seconds on its first measured visit and 2.40 seconds on a warm repeat. The first visit waited until 5.19 seconds to discover the hero image. The new streaming boundary addresses that dependency; these mixed cache states are not presented as a controlled percentage speedup. Final episode image traffic is about 30 KB, versus 89 KB before sharing artwork.

Shows-page font swapping originally shifted filters and cards enough to produce CLS 0.160. The adjusted fallback eliminated the measured shift. The final visible-card priority follow-up in `shows-visible.json` records LCP 1.404 seconds and CLS 0. All four visible card images finish by 2.58 seconds, versus 4.44 seconds before that adjustment. The first card alone takes slightly longer (2.58 versus 1.96 seconds) because it shares early bandwidth with the other visible cards; the complete visible grid arrives sooner. This avoids relying only on the decorative header LCP.

Unthrottled desktop homepage LCP measured 240 ms in the repeat. These are local lab results, not production percentiles or a guarantee for all devices, networks or content.

## What changed

1. **Off-screen card images wait until nearby.** `NearViewportImage` observes a 300 px margin around the viewport and scroll containers. It reserves the existing image box and requests artwork once the card approaches view. Priority images stay in the initial HTML with real URLs. Observers disconnect after activation and on unmount. Unsupported browsers fall back to loading images. A server-rendered `noscript` image preserves the component's fallback when scripting is disabled. The surrounding Next streaming shell still requires JavaScript; this is not a claim of a fully functional no-JavaScript site.
2. **The homepage hero downloads the crop it displays.** Square cropping happens at Imgix. Screens up to 440 CSS pixels receive candidates up to 800 pixels, keeping more than two image pixels per displayed CSS pixel on the tested 390 px screen. Quality remains 75; desktop retains its larger responsive candidates. The CDN gets an early preconnect.
3. **Removed redundant homepage prefetch.** The logo link no longer prefetches the homepage while that page is already open. Other navigation prefetch behavior remains available.
4. **Episode hero streams independently.** Artwork, title and the hero play control no longer wait for related episodes, genre lookup and account state. Those details remain behind a Suspense boundary and preserve their existing behavior. Compact player data crosses the client boundary; article body and tracklist remain in the detail content.
5. **Episode backdrop shares the foreground image.** Both use the same responsive URL candidates and sizing hint, so the browser reuses one download. The backdrop remains blurred and decorative, with empty alt text to avoid announcing the title twice.
6. **Matched the mono fallback's text metrics.** Founders Mono has 614/1000-em advances. The fallback uses a local fixed-width Courier-compatible face with a 102.3333% size adjustment and matching vertical metrics, instead of the generated enlarged proportional Arial fallback. This prevents filter-row rewrapping when the web font arrives. Generic monospace remains available if none of the specified local faces exists.
7. **Visible Shows cards load early.** The first four cards cover the first two mobile rows and bypass deferred loading. This addresses actual visible-image completion, not just the LCP header metric.

## Validation

- Production build with enforced TypeScript checking passed.
- All 157 unit tests across 25 isolated suites passed.
- Eleven Chromium browser scenarios passed across search, live freshness, playback/navigation, deferred artwork and the image's no-JavaScript fallback. Two image scenarios also passed in WebKit. These are browser-engine checks, not tests on a physical iPhone.
- The image checks verify an 800×800 mobile hero request without duplicate downloads, a distant card loading on approach, and the actual server-rendered `noscript` fallback in an isolated document. The isolated document is needed because Next's streamed page shell is independently JavaScript-dependent.
- Targeted lint has no errors; existing `any`/unused warnings remain. Formatting and whitespace checks passed.

## Measurement method and limits

`browser-probe.cjs` supports `PERF_PATH`, `MOBILE_ONLY`, `PERF_RESULT` and `PERF_SCREENSHOT`. It runs a production build at localhost:3102 with Chromium, a 390×844 viewport, DPR 3, 4× CPU slowdown and configured 200,000 bytes/s download throughput plus 150 ms latency. Actual localhost TTFB does not represent that configured network round trip. Each probe uses a fresh browser context. Final route probes ran sequentially without competing browser tests. Cache warmth and live CMS content can vary between runs.

The trace records LCP, CLS, visible-image completion, resource traffic and page errors. `near-viewport.json` captures the first reduction to 4.14 seconds. `mobile-hero.json`, `repeat.json` and `home-complete.json` capture the subsequent homepage improvement. `shows*.json` records font stability and visible-card loading. `episode-before.json`, `episode-warm-before.json` and `episode-complete.json` distinguish initial/warm behavior and the shared artwork request. PNGs preserve the tested layouts.

Remaining production verification is unchanged: confirm mobile/desktop traffic mix, field p75 LCP/INP/CLS by route and region, deployed cache hit/miss behavior, publish webhook freshness and actual peak traffic. A small set of local routes cannot certify every page or six-figure weekly production capacity. The homepage now has a substantially better mobile loading baseline for that rollout.

## Final publishing checks

The full repository checks also exposed a footer outage path: a failed cold social-link read could interrupt unrelated pages. The footer now catches that failure outside its cached renderer and renders the existing static navigation without social links. The failed refresh is not stored as empty cached content. All three CI upload reliability browser scenarios passed against a deliberately nonexistent CMS test bucket after this fix.

CI now invokes the isolated unit runner through `bun run test`; its test-only TypeScript target supports top-level async mock setup. Benchmark TypeScript files use the TypeScript ESLint parser. Full lint passes with existing warnings, both CI type checks pass, and the final production build passes. Vercel Doctor scores the final changes 97/100; remaining heuristics include intentional link prefetch, dependent reads, and uncached administrative mutation endpoints. Those endpoints must not be made CDN-cacheable just to clear a generic warning.
