import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).io = () => ({ on() {}, disconnect() {} });
    (window as any).__playCount = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      (window as any).__playCount++;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
});

test('programme boundary refreshes metadata without restarting a paused stream', async ({
  page,
}) => {
  let reads = 0;
  await page.route('**/api/live/current', route => {
    reads++;
    return route.fulfill({
      json: {
        success: true,
        scheduleShow: {
          name: reads === 1 ? 'First Programme' : 'Second Programme',
          url: '/schedule',
          slug: null,
          endsAt: new Date(Date.now() + (reads === 1 ? 3000 : 60000)).toISOString(),
        },
      },
    });
  });
  await page.goto('/');
  const label = page.getByTestId('live-player-label');
  await expect(label).toHaveText(/first programme/i);
  const toggle = page.getByTestId('live-player-toggle');
  await toggle.click();
  await toggle.click();
  const plays = await page.evaluate(() => (window as any).__playCount);
  await expect(label).toHaveText(/second programme/i);
  await expect(toggle).toHaveAttribute('data-state', 'paused');
  expect(await page.evaluate(() => (window as any).__playCount)).toBe(plays);
});

test('returning to the tab refreshes and an upstream failure preserves healthy metadata', async ({
  page,
}) => {
  let fail = false;
  let reads = 0;
  await page.route('**/api/live/current', route => {
    reads++;
    return route.fulfill({
      status: fail ? 503 : 200,
      json: fail
        ? { success: false }
        : {
            success: true,
            scheduleShow: { name: 'Healthy Programme', url: '/schedule', slug: null },
          },
    });
  });
  await page.goto('/');
  const label = page.getByTestId('live-player-label');
  await expect(label).toHaveText(/healthy programme/i);
  const before = reads;
  fail = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => reads).toBeGreaterThan(before);
  await expect(label).toHaveText(/healthy programme/i);
});

test('a confirmed empty schedule clears an old RadioCult programme label', async ({ page }) => {
  let empty = false;
  await page.route('**/api/live/current', route =>
    route.fulfill({
      json: {
        success: true,
        scheduleShow: null,
        matchingShowSlug: null,
        currentEvent: empty ? null : { showName: 'Earlier Programme', artists: [] },
      },
    })
  );
  await page.goto('/');
  const label = page.getByTestId('live-player-label');
  await expect(label).toHaveText(/earlier programme/i);
  empty = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(label).not.toHaveText(/earlier programme/i);
});
