import { expect, test } from '@playwright/test';

const facets = { genres: [{ id: 'jazz', slug: 'jazz', title: 'Jazz' }], hosts: [], locations: [] };
const result = (title: string) => ({
  results: [
    {
      id: '123456789012345678901234',
      slug: 'test-episode',
      title,
      metadata: { broadcast_date: '2026-09-06' },
    },
  ],
  hasNext: false,
  nextCursor: null,
});
async function openSearch(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open search' }).filter({ visible: true }).first().click();
}
test('filters retry independently and reopening reuses the fresh facet response', async ({
  page,
}) => {
  let facetReads = 0;
  const cosmic: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).hostname === 'api.cosmicjs.com') cosmic.push(request.url());
  });
  await page.route('**/api/search/filters', route => {
    facetReads++;
    return route.fulfill({
      status: facetReads === 1 ? 502 : 200,
      json: facetReads === 1 ? { error: 'Unavailable' } : facets,
    });
  });
  await page.route('**/api/search?*', route =>
    route.fulfill({ json: result('Gilles Test Programme') })
  );
  await openSearch(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Gilles Test Programme').filter({ visible: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry filters' }).click();
  await expect(dialog.getByText('Genre', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open search' }).filter({ visible: true }).first().click();
  await expect(dialog.getByText('Genre', { exact: true })).toBeVisible();
  expect(facetReads).toBe(2);
  expect(cosmic).toEqual([]);
});

test('a later query wins over an older slow response', async ({ page }) => {
  await page.route('**/api/search/filters', route => route.fulfill({ json: facets }));
  await page.route('**/api/search?*', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'alpha') await new Promise(resolve => setTimeout(resolve, 1000));
    await route.fulfill({
      json: result(
        q === 'alpha' ? 'Old Alpha Result' : q === 'beta' ? 'New Beta Result' : 'Initial Result'
      ),
    });
  });
  await openSearch(page);
  const input = page.getByRole('dialog').getByPlaceholder('Search').filter({ visible: true });
  await input.fill('alpha');
  await page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'alpha');
  await input.fill('beta');
  await expect(page.getByText('New Beta Result').filter({ visible: true })).toBeVisible();
  await page.waitForTimeout(1100);
  await expect(page.getByText('Old Alpha Result')).toHaveCount(0);
});

test('an initial search failure can be retried without changing the query', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/search/filters', route => route.fulfill({ json: facets }));
  await page.route('**/api/search?*', route => {
    reads++;
    return route.fulfill({
      status: reads === 1 ? 502 : 200,
      json: reads === 1 ? { error: 'Unavailable' } : result('Recovered Programme'),
    });
  });
  await openSearch(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Recovered Programme').filter({ visible: true })).toBeVisible();
  expect(reads).toBe(2);
});

test('mobile search retains reachable filters and close controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/search/filters', route => route.fulfill({ json: facets }));
  await page.route('**/api/search?*', route => route.fulfill({ json: result('Mobile Programme') }));
  await openSearch(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Mobile Programme').filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit filters' }).click();
  await expect(dialog.getByText('Genre', { exact: true })).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(845);
  await page.getByRole('button', { name: 'Close search', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
