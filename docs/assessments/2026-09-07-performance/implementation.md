# Next/Cosmic improvements — 7 September 2026

Implemented locally following the assessment. Search work was completed separately in commit `4187895`; the subsequently authorized [search follow-up](search-follow-up.md) adds shared result/facet caching and browser checks. Existing homepage curation and editorial changes were preserved. Nothing from this implementation has been deployed or pushed.

The additional [second performance pass](second-pass/report.md) measures payload, image, font and interaction improvements for the high-traffic audience.

The subsequent [mobile pass](mobile-pass/report.md) reduces measured mobile homepage LCP to about 2.1 seconds and checks Shows and episode routes.

## What changed

- Public CMS reads now use a server-only native transport with `use cache: remote`, stable query keys, explicit published status, bounded timeouts and retries, and cache-fill telemetry. Homepage, episode, schedule, navigation, footer, legal, about, membership landing, editorial and video readers use this layer. Account/member records and draft reads remain outside it.
- Weekly episode reads use one paginated date-set query instead of seven daily queries. Manual schedules paginate too. Current programme selection uses the request clock outside the cached dataset, including London/BST boundaries. Expanded episode data is reused where available.
- RadioCult schedule requests use stable day-window keys and a short shared cache. The old fallback that advertised finished/future programmes as current was removed. A missing current programme does not prevent listening to the station.
- `/api/live/current` allows at most five seconds of CDN caching, capped at known programme boundaries. Errors are not cached. The client prevents overlapping reads, cancels on unmount, stops interval polling in hidden tabs, refreshes when visible and at programme end, and preserves valid metadata during failures. Metadata changes do not start or interrupt audio.
- Cache tags now correspond to readers and mutations. Publication webhooks support authenticated object type/slug payloads; creation, weekly generation and tracklist mutations invalidate affected episode data. Expanded relationships have a conservative shared invalidation tag so a linked host/image edit can refresh parent content too.
- Real upstream failures throw rather than becoming cached empty lists or missing pages. Confirmed Cosmic “No objects found” remains valid absence. Cached homepage refreshes propagate section errors; uncancelled timeout races were removed.
- Homepage content is a Cache Component rather than waiting on `connection()`. The root loading boundary reserves page space. Split hero images advertise their real width. Socket.IO is loaded once. Homepage editorial/video queries request three displayed items, not twenty; the video section now respects newest-first order.
- Production builds enforce TypeScript checks. Two pre-existing email paths now initialize their Resend client correctly. Cache boundaries accommodate footer dates and server HTML sanitization. Unit suites run in separate processes because Bun module mocks otherwise leak between unrelated files.

## Freshness and cost policy

| Layer | Time-based policy | Change handling |
|---|---|---|
| Shared Cosmic episodes/schedules | Revalidate after 60 seconds; expire after one hour | Content tags expire on mutation/webhook |
| Other shared public CMS objects | Revalidate after five minutes; expire after one hour | Type/entity and expanded-relationship tags |
| Rendered homepage | Five-minute refresh profile | Homepage, hero, episode and relationship invalidation |
| RadioCult schedule dataset | 15-second refresh; 120-second expiry | `radiocult`/`schedule` tags |
| Live HTTP response | Up to five seconds at CDN, no browser reuse without validation | TTL capped at known transition |
| Live client | Existing two-minute interval while visible | Immediate visibility and programme-end refresh |

Outer cached readers retain their named Next cache profiles. Refresh times are demand-driven stale-while-revalidate targets, not hard publication deadlines. Webhooks are the primary way to deliver prompt edits; open browsers also need navigation or an explicit refresh to see ordinary page changes. During an upstream outage, retaining valid cached content is bounded by cache policy; a cold miss can still fail.

A Cosmic CDN hit still counts as an upstream request. The relevant outcome is fewer `cosmic.read` events per 1,000 page views, not a higher Cosmic hit percentage. Vercel remote-cache reads/writes and function costs must be included when comparing bills. No fixed percentage or currency saving is claimed.

## Validation

- Production build and TypeScript checks passed on Next 16.2.12 / React 19.
- 148 unit tests across 22 isolated suites passed, including public-only reads, retries, documented absence versus errors, invalidation authentication, London programme boundaries and RadioCult programme selection.
- Three production-build Chromium freshness tests passed: programme transition while paused; refresh failure retaining metadata; confirmed empty schedule clearing an old label. Four existing audio tests also passed. The existing fallback test initially mismatched its fixture-only `https://example.com/stream` URL. A dedicated production recovery probe then passed against the actual configured stream URL, confirming a visible correct recovery link and paused audio. The fast-poll fixture test was not run against the production two-minute interval; boundary and visibility refreshes are covered separately.
- The baseline mock schedule probe needed eight queries on every invocation. The new uncached mock path needs two per one-page dataset fill. Its second invocation also reports two because Bun mocks bypass Next's cache compiler; this is a query-shape check, not cache-hit evidence.
- A real local `next start` check made ten concurrent live requests after warming the cache: all returned 200/success and emitted **zero additional Cosmic reads**. Latencies ranged 7–37 ms on this machine. See [recorded results](warm-live-cache-results.json). This proves reuse in one process, not cross-instance or cross-region Vercel behavior.
- Desktop/mobile browser results and screenshots are recorded alongside this report. Final post-change mobile CLS was 0.014 versus the deployed baseline 0.833; desktop CLS was zero versus 0.343. The homepage was visible, where the original slow-mobile run still hid the main content after 35 seconds. These are lab samples against different hosting environments/content states, not production Web Vitals or a controlled percentage speedup.
- Final lab homepage payload was approximately 1.04 MB decoded / 162 KB gzip; simulated mobile LCP was 11.3 seconds and load 13.4 seconds. Mobile loading remains too slow. The original 2.6-second LCP candidate did not represent the hidden main content, so it is not a valid before/after speed comparison. Reducing the homepage list queries lowered the local gzip payload from roughly 199 KB to 162 KB, but production uses a different hosting/compression setup.
- Targeted lint has no errors; existing loose-type warnings remain. `git diff --check` passed.

## Deployment requirements and follow-through

1. Deploy to a preview environment and verify Vercel's remote-cache handler is active. Local `next start` falls back to local cache storage. Confirm cache reuse across instances and inspect cache costs before evaluating savings.
2. Configure or verify Cosmic webhooks for publish, update, unpublish and delete against `/api/revalidate`, authenticated with `Authorization: Bearer <REVALIDATION_SECRET>`. The legacy `?secret=` form remains supported if the provider cannot set headers. A supported body is `{"object":{"type":"episode","slug":"example-show"}}`; flat `{ "type": "episode", "slug": "example-show" }` also works. Relationship edits must send the edited object's type. Existing manual tags/paths remain supported. The local revalidation secret is configured; the Cosmic dashboard's actual webhook payload/configuration and production secret were not inspected or changed.
3. Publish/edit/unpublish a disposable preview item and verify detail, homepage, schedule and relationship refreshes. Check webhook delivery logs and retries. API success confirms invalidation execution, not delivery to an already-open browser.
4. Compare seven-day traffic-normalized Cosmic requests/bandwidth, Vercel cache/function usage, errors and real LCP/CLS/INP. The homepage still has substantial HTML/React and image payloads; further trimming needs card-specific data contracts and field measurements. Media storage usage is independent of this cache work.
5. The subsequently authorized [search follow-up](search-follow-up.md) now addresses direct browser genre reads, duplicate facets and shared runtime caching of search/facets, preserving the shipped latency improvements.

## Current guidance used

Reviewed the requested [Next.js development skill](/Users/karlkoch/.agents/skills/nextjs-development/SKILL.md) against the installed framework and official documentation. Used App Router Cache Components and authenticated tag expiry rather than Pages Router ISR examples or assuming the Axios SDK participates in Next fetch caching. Relevant references: [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache), [remote cache](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote), [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife), [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [Vercel Cache Components](https://vercel.com/academy/nextjs-foundations/cache-components), and [Cosmic objects API](https://www.cosmicjs.com/docs/api/objects).
