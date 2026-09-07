import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test('mobile hero requests a suitably sized image and off-screen cards load on approach', async ({
  page,
}) => {
  const imageRequests: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'image' && request.url().includes('imgix.cosmicjs.com'))
      imageRequests.push(request.url());
  });
  await page.addInitScript(() => {
    (window as any).io = () => ({ on() {}, disconnect() {} });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const hero = page.locator('main img[fetchpriority="high"]').first();
  await expect
    .poll(() =>
      hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);
  const source = new URL(await hero.evaluate((image: HTMLImageElement) => image.currentSrc));
  expect(source.searchParams.get('w')).toBe('800');
  expect(source.searchParams.get('h')).toBe('800');
  expect(imageRequests.filter(url => new URL(url).pathname === source.pathname)).toHaveLength(1);

  const distant = page.locator('main img[src^="data:image/gif"]').first();
  await expect(distant).toBeAttached();
  const element = await distant.elementHandle();
  const alt = await element!.getAttribute('alt');
  await element!.scrollIntoViewIfNeeded();
  const revealed = page.locator('main img');
  await expect
    .poll(() =>
      revealed.evaluateAll(
        (images, label) =>
          images.some(image => {
            const img = image as HTMLImageElement;
            return (
              img.alt === label &&
              img.complete &&
              img.naturalWidth > 1 &&
              !img.currentSrc.startsWith('data:')
            );
          }),
        alt
      )
    )
    .toBe(true);
});

test('card artwork remains available when JavaScript is disabled', async ({ browser, request }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  // Isolate the actual server-rendered fallback from Next's JS-dependent streaming shell.
  const html = await (await request.get('/')).text();
  const fallback = html.match(/<noscript><img\b[^>]*><\/noscript>/)?.[0];
  expect(fallback).toBeTruthy();
  await page.setContent(`<html><body>${fallback}</body></html>`);
  const image = page.locator('noscript img').first();
  await expect(image).toBeAttached();
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 1))
    .toBe(true);
  await context.close();
});
