import { expect, test } from '@playwright/test';

test('compact homepage cards keep navigation and archive playback working', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).io = () => ({ on() {}, disconnect() {} });
  });
  await page.route('**/api/live/current', route =>
    route.fulfill({ json: { success: true, currentEvent: null, scheduleShow: null } })
  );
  await page.route('https://www.mixcloud.com/widget/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<html><body>Player fixture</body></html>' })
  );
  await page.goto('/');
  const play = page.getByRole('button', { name: 'Play show', exact: true }).first();
  await play.scrollIntoViewIfNeeded();
  await play.hover();
  const episodeLink = play.locator('xpath=ancestor::a[1]');
  await expect(episodeLink).toHaveAttribute('href', /\/episode\/.+/);
  await play.click();
  const player = page.locator('iframe[src*="mixcloud.com/widget"]');
  await expect(player).toBeVisible();
  const source = new URL((await player.getAttribute('src'))!);
  expect(source.searchParams.get('feed')).toMatch(/worldwidefm/i);
  await expect(page).toHaveURL(/\/$/);
});

test('interactive episode browsing uses the server without browser Cosmic reads', async ({
  page,
}) => {
  const cosmicReads: string[] = [];
  page.on('request', request => {
    if (/api\.cosmicjs\.com/.test(request.url())) cosmicReads.push(request.url());
  });
  await page.addInitScript(() => {
    (window as any).io = () => ({ on() {}, disconnect() {} });
  });
  await page.route('**/api/live/current', route =>
    route.fulfill({ json: { success: true, currentEvent: null, scheduleShow: null } })
  );
  const action = page.waitForResponse(
    response =>
      response.request().method() === 'POST' && !!response.request().headers()['next-action']
  );
  await page.goto('/shows?type=episodes&searchTerm=gilles');
  expect((await action).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Play show', exact: true }).first()).toBeAttached();
  expect(cosmicReads).toEqual([]);
});
