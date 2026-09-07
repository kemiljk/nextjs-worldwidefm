Implementation follow-up: [changes, validation and deployment requirements](implementation.md). The assessment below records the pre-change baseline.

**Worldwide FM performance, freshness and Cosmic usage assessment — 7 September 2026**

There is a substantial, demonstrable opportunity to reduce Cosmic traffic. The highest priority is the global live-player endpoint: it rebuilds the entire weekly schedule for each caller. Shared caching should make upstream traffic depend on content changes and refresh intervals, rather than audience size. Longer browser polling intervals alone would trade away freshness while leaving the underlying multiplier intact.

This assessment includes source inspection, an isolated query-count experiment, read-only production HTTP probes, desktop and simulated mobile browser measurements, and the existing unit suite. Application code and deployment settings were not changed. Local HEAD was `f93fc89`; pre-existing homepage/editorial changes are present and search files changed concurrently during the assessment, so source findings describe this checkout and production measurements describe the deployed site separately. The deployment commit was not verified. No production load test or CMS writes were performed.

**What the Cosmic screenshot establishes**

| Meter | Reported value | Interpretation |
|---|---:|---|
| Cached API requests | 5,542,101 | Still calls reaching Cosmic |
| Non-cached API requests | 146,032 | Additional upstream work |
| Total API requests | 5,688,133 | 97.43% classified as cached |
| API bandwidth | 22.43 GB | Request count is a separate optimisation target |
| Media requests / bandwidth | 240,489 / 32.37 GB | Separate from object API traffic |
| Media storage | 8.43 / 10 GB | 84.3% occupied; caching does not reclaim storage |

The screenshot explicitly warns about cached-request overages. A high Cosmic cache-hit percentage therefore does not mean the application is avoiding metered requests. Cosmic lists cached requests as a separate allowance on its [pricing page](https://www.cosmicjs.com/pricing). The account's actual plan and billing rates were not available; the screenshot's “this week” may also be a partial week. No invoice estimate or guaranteed total saving is justified yet.

**1. Highest priority: eight Cosmic queries per live poll, even with warm process memory**

Evidence: `components/live-player.tsx:52,85–120`, `app/api/live/current/route.ts:11–34`, `lib/schedule-service.ts:220,331,355,430,470`.

The player mounts globally, fetches immediately and repeats every 120 seconds by default, regardless of playback state. The endpoint explicitly disables HTTP caching. Each call to `getCurrentScheduleShow()` invokes `getWeeklySchedule()`, which queries all schedule objects once and episodes separately for seven dates. Individual linked episodes can add more lookups. RadioCult title matching can add another Cosmic query when its local cache misses, even when the schedule has already supplied the displayed show. RadioCult's own schedule request also forces a fresh fetch using rolling timestamp parameters.

The isolated probe returned **8 queries on the first call and 8 on the immediately repeated call**. Its empty successful fixtures deliberately exclude extra relationship lookups: this measures the base path, not a production payload or outage. See [query-count evidence](schedule-query-count.txt) and [reproducible probe](schedule-probe.ts).

At the default interval, the base path is approximately `30 polls × 8 queries = 240 Cosmic requests per tab-hour`, plus the mount request. For 1,000 concurrently open tabs that is about **240,000 requests/hour**. Browser background throttling and the deployed environment override can alter the rate. If the screenshot represented seven full days, this path alone would need only about 141 continuously polling tabs to reach its total; that is a scale illustration, not attribution of the bill.

Recommended change: cache the published weekly schedule dataset in shared runtime storage using a stable London week key, and determine the current show from that dataset and the current clock outside the long-lived cache. Reuse the same data for `/schedule`, live metadata and member reminders. Consolidate the seven episode queries into a paginated week-range query if response sizes allow. Preserve manual overrides, replay precedence and relationship resolution.

With one shared cache partition and a five-minute refresh, the existing eight-query fill would be about **16,128 queries/week**, before invalidations, evictions and retries. A two-query fill would be about **4,032/week**, before pagination and linked-object lookups. Multiple regions/partitions multiply this; neither number forecasts total site traffic. Crucially, ten times the listeners should not require ten times the CMS reads.

Keep the audio transport independent of metadata. Optionally give the public metadata response a short CDN TTL, capped at the next show boundary, once acceptable freshness and purge behaviour are verified. Data caching alone provides major savings without extending the current polling interval. Avoid doing title matching when a valid schedule link already exists. Add bounded retries, an in-flight request guard and jitter; preserve refreshes for background listeners who are actually playing audio.

**2. Cache profiles exist, but many reads never use them**

Evidence: `next.config.mjs:12`, `lib/actions/homepage.ts:9,47`, `app/page.tsx:29,171`, `lib/cosmic-service.ts:411`, `components/footer.tsx:11`, `lib/cached-data.ts:8`, `lib/episode-service.server.ts:1`.

The installed Cosmic SDK 1.2.0 uses Axios. Its ordinary reads do not acquire Next's extended-fetch caching or request memoisation automatically. Configuring `cacheLife.hero`, `schedule` or `homepage` does not wrap those reads. The homepage fetch is called independently from metadata generation and the page body without an explicit shared wrapper. Posts, videos, navigation and social links also have direct read paths. The cached genre helper exists but callers use the uncached helper.

Some episode and editorial reads correctly use `use cache`; this is partial coverage, not an absence of caching. Plain `use cache` defaults to memory storage and can participate in the static shell, but should not be assumed to provide a durable cache shared across serverless instances. Validate the actual hosting behaviour and use a shared runtime cache for hot dynamic reads. See [Next's cache storage documentation](https://nextjs.org/docs/app/api-reference/directives/use-cache) and [remote caching](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote).

Recommended change: introduce a small server-only public-content access layer, with explicit policies per content type and request-level deduplication. Cache public sections for prerendering where possible and shared datasets where runtime access is necessary. Keep cookies, membership status, reminders and staff/preview data outside public caches. Measure Vercel runtime-cache operations and function execution as well as Cosmic savings, so the work reduces combined cost.

**3. Invalidation needs to become a tested publishing contract**

Evidence: `app/api/revalidate/route.ts:55–109`, all `cacheTag` calls in `lib/cached-data.ts`, `lib/episode-service.server.ts`, `lib/editorial-page-data.ts`; `lib/episode-archive.ts:12`; `lib/create-weekly-shows.ts`; `app/api/shows/create/route.ts`.

The revalidation endpoint accepts tags and paths, and defaults to expiring all major tags. However, tags such as `hero`, `homepage`, `latest`, `schedule` and `navigation` are not attached to corresponding readers in this checkout. The endpoint can report success for tags that affect no cached data. Episode mutations broadly expire `episodes`; creation and weekly-generation paths have no explicit application-cache invalidation. A Cosmic dashboard webhook may exist, but its configuration and delivery were not verified.

Before increasing TTLs, map publish, update, unpublish, delete and relationship changes to real cache dependencies. An episode edit can affect its detail page, lists, schedule, host/takeover pages, homepage curation and search facets. Prefer bounded list tags plus entity tags over expiring every episode detail for each edit. Authenticate webhooks, record delivery and retries, and test them end to end. Acknowledge successful invalidation only after the intended operation succeeds. Ordinary edits can use stale-while-revalidate where acceptable; unpublishing and access changes need immediate expiry. [Next documents the difference between stale-while-revalidate and immediate expiration](https://nextjs.org/docs/app/api-reference/functions/revalidateTag).

Proposed freshness policies for validation, not settings already implemented:

| Data | Refresh fallback | Change handling |
|---|---|---|
| Weekly published schedule | 1–5 minutes | Webhook invalidation; compute live selection against the clock |
| Live metadata response | Uncached initially; optional 5–15 seconds | Cap at next transition; refresh on visibility/playback changes |
| Homepage, latest lists | 5–15 minutes | Publishing webhook invalidates affected sections |
| Editorial, hosts, genres, navigation | 1–24 hours by type | Targeted invalidation on edits and deletions |
| Archive details | 24 hours | Entity invalidation; immediate expiry on unpublish |
| Account data, previews, staff state | Private/request-scoped | Never use anonymous public response caching |

TTL revalidation is generally demand-driven and can serve stale data while refilling; it is not a hard publication deadline. A hard freshness requirement needs measured webhook delivery, refresh completion and client refresh behaviour. Explicitly test midnight, Monday rollover, British Summer Time changes and delayed/missed webhooks.

**4. Failures currently risk being mistaken for valid empty content**

Schedule fetchers catch upstream failures and return empty arrays. Cached detail fetchers catch non-404 errors and return `null`, which can then be cached as a successful result. During a CMS outage this can turn existing content into an empty schedule or apparent missing episode. Several homepage `Promise.race` timeouts stop waiting but do not cancel the upstream request. The SDK's Axios calls do not set a timeout in the inspected transport.

Recommended change: distinguish confirmed absence from transient failure before adding cache wrappers. Retain last-known-good public content for a bounded stale period, propagate refresh failures to observability, and avoid replacing healthy cache entries with empty fallbacks. Use actual transport deadlines/cancellation and bounded retry budgets with jitter. Do not continue showing an expired programme as “live”: retain schedule data but compute its validity using current time. Test concurrent misses and expired-cache refreshes to prevent request bursts after publication.

**5. Search has a confirmed browser-to-Cosmic path; the legacy bulk loader is not proven active**

Evidence: `components/search/search-dialog.tsx:141–152`, `lib/get-canonical-genres.ts:9`, `lib/actions/filters.ts:60`, `components/providers/search-provider.tsx:52`, `lib/search-engine.ts:89,175,226`.

Opening the production search dialog generated a direct Cosmic XHR, matching the uncached genre helper imported into the client. It bypasses any application-side server cache. The current dialog otherwise fetches the selected type with a 300 ms debounce and pagination; keep those useful controls. Facets also repeat server-side reads and genres are requested twice through separate paths.

The global provider retains a separate lazy loader that can fetch up to 1,000 objects per type. Repository searches found no consumer invoking its initializer outside the provider, and the observed search opening did not exercise that bulk loader. Treat it as architectural cleanup, not an established source of millions of requests.

Move facets behind a server-owned shared cache, reuse one genre dataset, and remove the unused bulk-search machinery if references confirm it is redundant. `getAllFilters` and `getShowsFilters` also pass `props`, `depth` and `limit` inside `.find({...})`; in the installed SDK those values become query fields instead of query-builder options. Correct the builder shape and validate complete facet results against [Cosmic's object API](https://www.cosmicjs.com/docs/api/objects). Don't introduce an external search service until query volume and latency justify its cost.

**6. Page loading has measurable costs beyond Cosmic request count**

Read-only HTTP probes against `www.worldwidefm.net`:

| Route | Status/cache marker | First byte | Complete body | Body bytes, uncompressed request |
|---|---|---:|---:|---:|
| `/` | 200 / Vercel HIT | 75 ms | 1.73 s | 1,148,447 |
| `/schedule` | 200 / Vercel PRERENDER | 261 ms | 543 ms | 107,650 |
| `/api/live/current` | 200 / Vercel MISS, no-store | 480 ms | 482 ms | 521 |

The apex redirects to `www`. These are individual probes, not percentiles. A cached shell can coexist with runtime work and streaming; the cache marker does not prove zero Cosmic calls. The local pre-existing build manifest also marks the homepage partially static, but that build is dated 2 September and was not treated as current deployment evidence.

Two fresh-context browser runs per device profile, with no scrolling or audio playback, produced:

| Observation | Desktop, unthrottled | Simulated mobile, 390×844, DPR 3, 4× CPU, 1.6 Mbps/150 ms |
|---|---:|---:|
| Reported LCP candidate | 0.69–1.05 s | 2.57–2.60 s |
| Layout shift, session-window score on repeat | 0.343 | 0.833 |
| Window load event | 0.53–1.01 s | 14.92–14.93 s |
| Cosmic image transfer by observation end | 1.55–2.00 MB | 2.24 MB |
| Compressed document body | ~121 KB | ~120–121 KB |
| Decoded document body | ~1.15 MB | ~1.15 MB |

These are synthetic observations, not Lighthouse scores, field CWV or an INP measurement. Browser observation ended eight seconds after load; the LCP candidate is not proof that meaningful page content is ready. In the throttled sample the page content was still not visibly laid out in the image sample. Layout-shift attribution specifically identified the footer moving into/out of the initial viewport as streamed content resolved. The root has an empty main Suspense fallback, consistent with that symptom. Confirm with real-user Speed Insights and mobile traces; [CLS guidance](https://web.dev/articles/cls) uses the largest session window and a field target of at most 0.1 at p75.

An additional simulated-mobile run waited 20 seconds after load (about 35 seconds after navigation). Its [screenshot](mobile-loading.png) still showed navigation and footer without the homepage content. [Extended measurements](mobile-extended-results.json) recorded the same 0.833 shift score and no JavaScript page errors. This is a reproducible synthetic reliability symptom requiring investigation; the exact cause and prevalence on real devices are not established. Do not interpret the apparently reasonable LCP as successful homepage delivery.

Recommended change: reserve meaningful homepage geometry during streaming and deliver critical hero content without waiting on all lower sections. Reduce nested Cosmic data serialized into client props to the fields actually rendered. The current homepage fetch uses depth 4 and sometimes refetches expanded section items individually; select and batch missing data instead. Keep hero images eager, but fix actual slot sizes: desktop hero cards around 694 CSS pixels wide requested a 1920-pixel candidate because `HeroImage` advertises `100vw`. This is a direct sizing opportunity at DPR 1; don't blindly cap high-DPR images and sacrifice quality.

The repeated desktop run fetched 29 scripts (~378 KB including transfer overhead) and three fonts (~137 KB); the mobile run fetched 22 scripts (~339 KB). The global search dialog is eagerly imported despite being closed. Consider lazy-loading it on intent, preserving quick keyboard/touch access. Many episode fetches occurred without navigation, consistent with link prefetching. Measure its runtime/cache cost before selectively limiting dense-grid prefetch; do not disable all prefetch and regress navigation. The image helpers already use responsive variants and compression, so assess actual selected resources before changing CDN providers or routing everything through Next Image.

**7. Measurement and release gates**

`lib/cosmic-monitoring.ts` is development-only, and `logApiCall` has no callers in the repository. Its historical percentage/dollar comments are not current evidence and the estimator ignores the cached-request overage at issue. Analytics and Speed Insights are mounted, but their account data was not available here.

Add production counters at actual outbound transport boundaries: operation name, caller/route, query fingerprint with secrets and personal data excluded, response bytes, latency, outcome and retries. Record shared cache hits/misses, refills, stale serves, webhook delay and function region. Cover all Cosmic client instances. Reconcile daily totals with the dashboard; other scripts, integrations and public-read-key clients can also contribute. Compare requests per 1,000 pageviews and per listening hour so rising audience size does not hide improvements. Include Cosmic API/media charges and Vercel compute/cache/egress in the cost comparison.

Recommended delivery order:

1. Establish counters and ship the shared schedule dataset with failure handling and publishing invalidation. Validate transitions, overrides, reminders, background playback and cold/concurrent requests.
2. Apply the same public-content layer to homepage/navigation/facets and cached detail readers. Verify publish/edit/unpublish/delete behaviour across all consumers before extending TTLs.
3. Reduce streaming layout shifts, serialized content, image oversizing and unnecessary client code. Compare identical mobile profiles and p75 field results.
4. Tune archive TTLs, search and prefetch using measured traffic. Address storage with a separate referenced-media audit; deleting files is not a request-caching fix.

Acceptance checks should include a tenfold simulated request increase in staging without proportional Cosmic reads for hot public datasets; bounded refills after invalidation; no private data in shared responses; explicit publish-to-visible timings; failure recovery that preserves valid content; and stable playback through metadata outages. Use representative staging data and mocked upstreams for concurrency tests before any production load testing.

The existing unit suite was run. Initial sandbox attempts could not bind local mock HTTP servers; the permitted rerun completed **123 passing tests and 1 failing test**. The failure is `upload API routes > leaves the episode alone when no episodeId is sent` (`test/api-upload-routes.test.ts:299`), expecting HTTP 200 and receiving 400. It predates any assessment changes in this turn; resolve or establish its intended behaviour before an optimisation release. No new build was run against production CMS data.

Reproduce the bounded probes from the repository root with `bun docs/assessments/2026-09-07-performance/schedule-probe.ts` and `node docs/assessments/2026-09-07-performance/browser-probe.cjs`. The first makes no network calls; the second opens the public homepage twice and opens search once. [Browser evidence](browser-results.json) stores request hosts/paths without query strings or credentials.
