# Search follow-up after 4187895

The shipped search work's lightweight results, five-item first page, cursor pagination, cancellation, short debounce and retry behavior are preserved. This follow-up is local and has not been pushed or deployed.

Changes:

- Results use the shared server-only public Cosmic transport, including remote caching, publication/relationship invalidation, bounded retries, timeouts and cache-fill telemetry. A bad upstream 404 now produces an error rather than being cached as “no matches”; documented empty results still work.
- Filter arrays are deduplicated and sorted before querying, so equivalent selections reuse the same cache entry. Host/takeover pagination has explicit creation-date ordering. Existing content-type filter conventions and episode date cutoff are retained.
- Search gets filters through one cancellable `GET /api/search/filters`. The browser no longer calls Cosmic for canonical genres or separately fetches duplicate genres. Only the three displayed taxonomies are loaded; the dialog receives IDs and titles (37,937 bytes for the measured dataset, versus 63,123 bytes with unused slugs/types).
- Shared facets select lean fields at depth zero and paginate beyond 1,000 records. Other public genre/filter consumers use the same data. Fixed the old SDK calls that incorrectly put `props`, `depth` and `limit` inside the CMS query itself.
- Facets refresh when search reopens after 60 seconds. Failed refreshes keep existing filters and expose an independent retry button; result search continues to work. Client requests have a 15-second deadline. Search HTTP responses are not browser/CDN cached, leaving freshness to the tagged server cache and bounded client state. The facet handler explicitly uses `connection()` after an end-to-end check caught Next prerendering a response that survived tag invalidation.
- Removed the unused global bulk-search provider from the mounted application tree after confirming there are no consumers. Its legacy implementation files remain available but no longer initialize with every page. Added an accessible name to the search button.

Validation:

- Production build passes, with TypeScript enforcement enabled. Targeted lint reports zero errors; existing loose-type warnings remain.
- 153 unit tests across 23 isolated suites passed. Coverage includes search bounds, native cursor options, normalized filters, error/empty distinction, and complete lean facet pagination. The final compact facet response also passed its targeted tests.
- Chromium checks cover filter failure/retry and reuse on reopen, a newer query replacing an older slow request, retry without changing the query, and mobile filter/close controls. No direct browser request to `api.cosmicjs.com` was observed in the tested search flow.
- Real CMS-backed local checks returned five initial results in about 2 KB and twenty continuation results with zero overlapping IDs. Four concurrent warm search/facet requests emitted zero additional `cosmic.read` events. Counts and timings are in [search-cache-results.json](search-cache-results.json). The taxonomy fixture returned 147 genres, 376 hosts and 155 locations.
- A real authenticated local object-type invalidation returned 200 and forced exactly one new genre read before serving filters. Subsequent warm result/facet requests still emitted zero additional CMS reads. See [invalidation evidence](search-invalidation-results.json). No Cosmic objects were edited.
- The original retry control already cleared the first-page cache; it did not need the speculative retry fix mentioned during investigation. Its behavior is preserved and tested.

Remote-cache behavior across Vercel instances, publishing webhook delivery, actual combined hosting/Cosmic costs and field Web Vitals still need deployment verification, as described in [the implementation report](implementation.md). These local measurements are not a claim of production savings.
