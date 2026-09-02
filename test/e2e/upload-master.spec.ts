import { expect, test, type Page } from '@playwright/test';

async function mockEpisodeSelection(page: Page) {
  await page.route('**/api/episodes/by-date**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        episodes: [
          {
            id: 'episode-1',
            slug: 'test-episode',
            title: 'Test Episode',
            metadata: {
              broadcast_date: '2099-01-01',
              broadcast_time: '18:00',
              duration: '120',
            },
          },
        ],
      }),
    });
  });
}

async function openHydratedUploadMaster(page: Page) {
  const hydrated = page.waitForResponse('**/api/live/current**');
  await page.goto('/upload-master');
  await hydrated;
}

test.describe('upload master reliability', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/live/current**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, currentEvent: null, scheduleShow: null }),
      });
    });
  });

  test('surfaces a Mixcloud timeout instead of hanging forever', async ({ page }) => {
    test.setTimeout(20_000);

    await mockEpisodeSelection(page);

    await page.route('**/api/upload-mixcloud', async () => {
      await new Promise(() => {
        // Intentionally never resolves to simulate a hung serverless function.
      });
    });

    await page.route('**/api/upload-media', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, radiocultMediaId: 'rc-e2e-timeout' }),
      });
    });

    await page.route('**/api/episodes/episode-1/archive', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await openHydratedUploadMaster(page);
    await page.locator('#broadcast-date').fill('2099-01-01');
    await page.getByPlaceholder('Search shows on this date').fill('Test Episode');
    await page.getByText('Test Episode').click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'master.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from([
        0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00,
      ]),
    });

    await page.getByRole('button', { name: 'Upload mastered audio' }).click();

    await expect(page.getByText(/mixcloud: failed/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('reports per-destination results on a mocked happy path', async ({ page }) => {
    await mockEpisodeSelection(page);

    await page.route('**/api/upload-mixcloud', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://www.mixcloud.com/worldwidefm/test-episode/' }),
      });
    });

    await page.route('**/api/upload-media', async route => {
      const body = route.request().postData() || '';

      if (body.includes('cleanupOnly')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, cleaned: true }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, radiocultMediaId: 'rc-e2e-1' }),
      });
    });

    await page.route('**/api/episodes/episode-1/archive', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await openHydratedUploadMaster(page);
    await page.locator('#broadcast-date').fill('2099-01-01');
    await page.getByPlaceholder('Search shows on this date').fill('Test Episode');
    await page.getByText('Test Episode').click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'master.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from([
        0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00,
      ]),
    });

    await page.getByRole('button', { name: 'Upload mastered audio' }).click();

    await expect(page.getByText(/mastered audio uploaded and episode updated/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('keeps the selected show and file visible when both destinations fail', async ({ page }) => {
    await mockEpisodeSelection(page);

    await page.route('**/api/upload-mixcloud', async route => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mixcloud unavailable' }),
      });
    });

    await page.route('**/api/upload-media', async route => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'RadioCult unavailable' }),
      });
    });

    let archivePatchCalled = false;
    await page.route('**/api/episodes/episode-1/archive', async route => {
      archivePatchCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await openHydratedUploadMaster(page);
    await page.locator('#broadcast-date').fill('2099-01-01');
    await page.getByPlaceholder('Search shows on this date').fill('Test Episode');
    await page.getByText('Test Episode').click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'master.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from([0xff, 0xfb, 0xe0, 0x40]),
    });

    await page.getByRole('button', { name: 'Upload mastered audio' }).click();

    await expect(
      page.getByLabel('Notifications alt+T').getByText(/mixcloud: failed \(mixcloud unavailable\)/i)
    ).toBeVisible();
    await expect(page.getByText('Test Episode', { exact: true })).toBeVisible();
    await expect(page.getByText('master.mp3', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/upload-master$/);
    expect(archivePatchCalled).toBe(false);
  });
});
