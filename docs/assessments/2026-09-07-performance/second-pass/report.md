# Second performance pass — 7 September 2026

Implemented and assessed locally against a production Next 16.2.12 build. These measurements compare the first caching/search pass with the additional changes below; they do not compare production before and after a deployment. Nothing has been pushed or deployed.

## Measured results

| Measure | Before this pass | After this pass |
| --- | ---: | ---: |
| Throttled mobile homepage LCP | 11.17 s | 8.01 s (repeat: 7.97 s) |
| Mobile homepage document, compressed | 162.6 KB | 102.4 KB |
| Mobile homepage document, decoded | 1.04 MB | 647 KB |
| Mobile initial image traffic | 1.72 MB | 1.14 MB |
| Mobile initial JavaScript traffic | 329 KB | 300 KB |
| All initially loaded fonts | 140 KB | 106 KB |
| Editorial listing document, compressed | 74.9 KB | 28.8 KB |
| Mobile cumulative layout shift | 0.014 | 0.014 |

Decimal units. Homepage document includes streamed server-component data. Desktop LCP changed from 392 ms to 236 ms, with a subsequent 316 ms repeat; localhost timings are not production latency predictions.

A bounded warm-cache exercise made 160 requests at concurrency 20 across the homepage, current programme endpoint, search and facets. All succeeded, with **zero additional Cosmic reads**. Local median was 20 ms and p95 399 ms. This checks cache reuse under a small burst; it does not certify production capacity, distributed cache behavior, cold starts or an upstream outage.

## Changes

- Introduced a compact card/player projection for homepage, archive, host, takeover, genre and related-episode lists. It retains images, broadcast times, navigation, hosts, tags and playback URLs while excluding article bodies, tracklists and expanded relationship metadata. Full episode/detail readers retain their content.
- The homepage requests five archive records where five are displayed. Existing curated content remains supported.
- Editorial list queries explicitly select card fields instead of transporting article bodies. Detail queries remain complete.
- Show-card responsive sizes now match the two-column mobile grid. Carousel sizes have their own override. Both visible split-hero images and the first two Shows-grid cards receive image priority; other optimized images have low fetch priority. Additional hero candidates avoid unnecessarily large downloads on smaller screens.
- Converted the existing brand font from WOFF to WOFF2: 92,600 to 58,840 bytes. Automated comparison verified the same character map, advances and all 947 glyph outlines. The original font remains in the repository.
- The search dialog is loaded when opened, with focus/hover preloading, rather than putting its implementation into every initial navigation. Its mounted state and fresh filter reuse survive reopening.
- Shows-page episode filtering/pagination now calls a bounded server action, returning compact cards through the existing shared public cache. It no longer imports the Cosmic episode reader into the browser. Equivalent filter arrays are deduplicated and sorted before reading; invalid limits and oversized inputs fail before a read. Host listing reads now use the same tagged public transport.

## Remaining bottleneck and production acceptance

The repeat mobile trace identifies the first hero image as LCP. Its request started at 222 ms, finished at 7.96 seconds, and rendered almost immediately afterward. This points to image transfer/network contention under the test conditions rather than late discovery, Cosmic response time or a long render delay. Eight-second lab LCP remains poor. Further visual-quality and image-loading experiments should be measured against real audience devices; reducing priority alone does not guarantee bandwidth allocation across image origins.

Imgix documents that `auto=format` negotiates modern formats and falls back to `fm`; the existing `fm=jpg` fallback is therefore not evidence that all supported browsers receive JPEG. No speculative format change was made. [Imgix image optimization guidance](https://medium.com/@imgix/find-and-fix-your-heaviest-images-with-page-weight-c15741a7790b).

Six-figure weekly visitors make per-visit overhead expensive, but weekly totals do not establish peak concurrency. Before claiming production readiness at peak traffic:

1. Compare mobile and desktop field p75 LCP, INP and CLS by route and geography. Target LCP at most 2.5 s, INP at most 200 ms and CLS at most 0.1; lab LCP alone is not a pass. These thresholds follow [Google's Core Web Vitals guidance](https://web.dev/articles/vitals).
2. Verify authenticated Cosmic publish/update/delete webhooks on the deployed environment, including relationship edits. Confirm update visibility and continued live-player boundary behavior. Time-based stale-while-revalidate is a fallback, not an instant publishing guarantee.
3. Measure `cosmic.read` counts per 1,000 visits, cache fills, errors and latency, alongside Vercel remote-cache/function costs and Cosmic billing. A Cosmic CDN hit still consumes an API request; a Next cache hit avoids it.
4. Replay the observed peak request mix against a preview/staging deployment, including cold and expired cache fills, multiple regions, popular versus unique searches and upstream failures. Use actual simultaneous listeners when estimating live polling load. No production load test was performed here.

## Validation and artifacts

The production build (including enforced TypeScript checking) passed. Nine Chromium production-build checks passed: four search scenarios, three live freshness/recovery scenarios, homepage card playback/navigation, and filtered episode browsing without browser Cosmic requests. Targeted lint reported no errors; existing broad `any`/unused warnings remain.

All 157 unit tests across 25 isolated suites passed. Coverage includes compact playback data and validation/canonicalization of interactive listing inputs, in addition to the earlier cache, retry, revalidation, schedule and search tests. The suite requires local fixture-server access; three fixture suites initially could not bind ports inside the sandbox, then passed with that access enabled.

- `before.json` and `final.json`: primary homepage comparison.
- `verified.json`: independent repeat with LCP element and resource timing.
- `*-mobile.png`: captured mobile layouts.
- `route-before-editorial-trim.json` / `route-after-editorial-trim.json`: editorial payload comparison; Shows and Schedule were controls already containing the earlier optimizations.
- `font-verification.json`: font equivalence evidence.
- `load-results.json`: bounded warm-cache concurrency result.
- `browser-probe.cjs` and `load-probe.cjs`: reproducible local probes. The load probe's server log path must match the server used for a new run.

Browser measurements used Chromium, a production server on localhost:3102, a 390×844 viewport at DPR 3, 4× CPU slowdown and a configured 200,000 bytes/s network limit with 150 ms latency. Actual localhost TTFB did not reflect a real 150 ms network trip. Desktop used 1440×1000 without throttling. Each navigation used a fresh browser context; server data was warm. Before is one sample; after has two clean comparable samples. Live CMS content can vary. The final Shows-only follow-up was subsequently rebuilt and browser-tested; homepage timing files precede that follow-up. These are directional lab measurements, not field percentiles or a guaranteed customer speedup.
