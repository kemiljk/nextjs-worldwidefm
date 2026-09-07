# Artwork regression verification — 7 September 2026

The deferred-image GIF decoded in Chromium but failed in WebKit. Its error handler belonged to the real artwork component, so an offscreen placeholder error permanently selected the station fallback before the real artwork was requested. Replace it with a valid SVG and attach artwork load/error handlers only after activating the real source.

Earlier coverage activated the first deferred card immediately and did not catch later offscreen placeholder errors. New coverage explicitly holds the observer, decodes the placeholder, dispatches an error, then releases the observer and checks the same image loads. Both 390px and 1440px viewports are covered.

Repeated WebKit visits also exposed homepage content appearing within the footer instead of main. Removing rendered JSX cache boundaries on Home and Footer resolved the observed production-build reproduction. Shared public CMS data caching remains enabled. This does not establish the precise framework-internal cause; response rendering cost should be reassessed separately.

Validation on the completed production build:

- 10 Playwright checks passed across Chromium and WebKit: placeholder decoding, deferred error isolation at both widths, mobile hero sizing, scrolling artwork, and standalone no-JavaScript image markup.
- Real image probe checked latest shows, archive, genres, and the first 20 hosts on mobile and desktop in both engines. 196 real artworks loaded. Eight recorded placeholders represent the same two hosts across four browser/viewport combinations: Parijita and Gayance. Direct Cosmic reads returned no image metadata for either host. The probe intentionally reports these as failures rather than silently excluding missing content; see `verified.json`.
- All 25 unit suites passed. Production build and test type check passed. Lint: zero errors, 412 warnings.
- Mobile WebKit screenshots visually inspected: latest artwork restored and all three homepage video cards use Lucide Play icons.

`check-sections.cjs` runs against a production server at localhost:3102 with real CMS data and real image requests. It checks the sampled current content, not every historic object or a physical iPhone. Browser tests stub the live socket to avoid unrelated connection noise.
