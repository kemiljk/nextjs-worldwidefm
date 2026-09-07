import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
]) {
  test.describe(`${viewport.width}px deferred artwork`, () => {
    test.use({ viewport });

    test('placeholder decoding and errors cannot permanently replace artwork', async ({ page }) => {
      await page.addInitScript(() => {
        const pending = new Map<Element, () => void>();
        const NativeObserver = window.IntersectionObserver;
        window.IntersectionObserver = function (
          callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit
        ) {
          const observer = new NativeObserver(callback, options);
          const observe = observer.observe.bind(observer);
          observer.observe = (target: Element) => {
            if (target instanceof HTMLImageElement) {
              pending.set(target, () =>
                callback([{ target, isIntersecting: true } as IntersectionObserverEntry], observer)
              );
            } else observe(target);
          };
          return observer;
        } as unknown as typeof IntersectionObserver;
        (window as any).pendingArtworkCount = () => pending.size;
        (window as any).releaseArtwork = () => {
          for (const release of pending.values()) release();
          pending.clear();
        };
        (window as any).io = () => ({ on() {}, disconnect() {} });
      });
      await page.route('https://imgix.cosmicjs.com/**', route =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="orange"/></svg>',
        })
      );
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const deferred = page.locator('main img[data-deferred-image="true"]').first();
      await expect(deferred).toBeAttached();
      await expect
        .poll(() => page.evaluate(() => (window as any).pendingArtworkCount()))
        .toBeGreaterThan(0);
      const artwork = await deferred.elementHandle();
      // Hold back the observer so Safari has time to decode the temporary resource.
      await artwork!.evaluate(async (img: HTMLImageElement) => {
        img.loading = 'eager';
        await img.decode();
        img.dispatchEvent(new Event('error'));
      });
      await expect(deferred).toBeAttached();
      await page.evaluate(() => (window as any).releaseArtwork());
      await expect
        .poll(() =>
          artwork!.evaluate(
            (img: HTMLImageElement) =>
              img.isConnected &&
              img.complete &&
              img.naturalWidth > 1 &&
              img.currentSrc.includes('imgix.cosmicjs.com')
          )
        )
        .toBe(true);
    });
  });
}
