import { expect, test, type Locator, type Page } from '@playwright/test';

const MP3 = {
  name: 'master.mp3',
  mimeType: 'audio/mpeg',
  buffer: Buffer.from([
    0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]),
};

const EPISODES: Record<string, { id: string; title: string }> = {
  '2099-01-01': { id: 'episode-1', title: 'First Show' },
  '2099-01-02': { id: 'episode-2', title: 'Second Show' },
};

async function mockBackend(page: Page, options: { uploadDelayMs?: number } = {}) {
  const stats = { inFlight: 0, maxInFlight: 0, uploaded: [] as string[] };

  await page.route('**/api/live/current**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, currentEvent: null, scheduleShow: null }),
    })
  );

  await page.route('**/api/episodes/by-date**', async route => {
    const date = new URL(route.request().url()).searchParams.get('date') || '';
    const episode = EPISODES[date];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        episodes: episode
          ? [
              {
                id: episode.id,
                slug: episode.id,
                title: episode.title,
                metadata: { broadcast_date: date, broadcast_time: '18:00', duration: '120' },
              },
            ]
          : [],
      }),
    });
  });

  await page.route('**/api/upload-mixcloud', async route => {
    stats.inFlight += 1;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    await new Promise(resolve => setTimeout(resolve, options.uploadDelayMs ?? 300));
    stats.inFlight -= 1;
    stats.uploaded.push('mixcloud');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://www.mixcloud.com/worldwidefm/test/' }),
    });
  });

  await page.route('**/api/upload-media', route => {
    const cleanup = (route.request().postData() || '').includes('cleanupOnly');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        cleanup ? { success: true, cleaned: true } : { success: true, radiocultMediaId: 'rc-1' }
      ),
    });
  });

  await page.route('**/api/episodes/*/archive', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  );

  return stats;
}

async function setUpShow(job: Locator, date: string, title: string) {
  await job.getByLabel('Broadcast date').fill(date);
  await job.getByPlaceholder('Search shows on this date').fill(title);
  await job.getByText(title).first().click();
  await job.locator('input[type="file"]').setInputFiles(MP3);
}

async function openUploadMaster(page: Page) {
  const hydrated = page.waitForResponse('**/api/live/current**');
  await page.goto('/upload-master');
  await hydrated;
}

test.describe('upload several masters on one page', () => {
  test('uploads queued shows one after another and reports each', async ({ page }) => {
    test.setTimeout(60_000);
    const stats = await mockBackend(page);
    await openUploadMaster(page);

    await setUpShow(page.getByTestId('upload-job-1'), '2099-01-01', 'First Show');
    await page.getByRole('button', { name: 'Add another show' }).click();
    const second = page.getByTestId('upload-job-2');
    // A new show starts on the previous show's broadcast date.
    await expect(second.getByLabel('Broadcast date')).toHaveValue('2099-01-01');
    await second.getByLabel('Broadcast date').fill('2099-01-02');
    await second.getByPlaceholder('Search shows on this date').fill('Second Show');
    await second.getByText('Second Show').first().click();
    await second.locator('input[type="file"]').setInputFiles(MP3);

    await expect(page.getByTestId('upload-queue-summary')).toHaveText('2 ready');
    await page.getByRole('button', { name: 'Upload 2 ready' }).click();

    await expect(page.getByTestId('upload-queue-summary')).toHaveText('2 uploaded', {
      timeout: 30_000,
    });
    expect(stats.uploaded).toHaveLength(2);
    // The whole point: never two uploads at once.
    expect(stats.maxInFlight).toBe(1);
    await expect(page.getByTestId('upload-job-1')).toContainText('Last upload: First Show');
    await expect(page.getByTestId('upload-job-2')).toContainText('Last upload: Second Show');
  });

  test('blocks starting another show while one is uploading', async ({ page }) => {
    test.setTimeout(60_000);
    const stats = await mockBackend(page, { uploadDelayMs: 1500 });
    await openUploadMaster(page);

    await setUpShow(page.getByTestId('upload-job-1'), '2099-01-01', 'First Show');
    await page.getByRole('button', { name: 'Add another show' }).click();
    const second = page.getByTestId('upload-job-2');
    await second.getByLabel('Broadcast date').fill('2099-01-02');
    await second.getByPlaceholder('Search shows on this date').fill('Second Show');
    await second.getByText('Second Show').first().click();
    await second.locator('input[type="file"]').setInputFiles(MP3);

    await page
      .getByTestId('upload-job-1')
      .getByRole('button', { name: 'Upload mastered audio' })
      .click();

    await expect(
      second.getByRole('button', { name: /waiting for the current upload/i })
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add another show' })).toBeDisabled();

    await expect(page.getByTestId('upload-job-1')).toContainText('Last upload: First Show', {
      timeout: 30_000,
    });
    await expect(second.getByRole('button', { name: 'Upload mastered audio' })).toBeEnabled();
    expect(stats.maxInFlight).toBe(1);
  });

  test('a failed show is flagged and does not stop the next one', async ({ page }) => {
    test.setTimeout(60_000);
    await mockBackend(page);
    let calls = 0;
    await page.route('**/api/upload-mixcloud', async route => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Mixcloud rejected the upload' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://www.mixcloud.com/worldwidefm/test/' }),
      });
    });
    // Radiocult also fails for the first show so it counts as a total failure.
    let mediaCalls = 0;
    await page.route('**/api/upload-media', async route => {
      const cleanup = (route.request().postData() || '').includes('cleanupOnly');
      if (!cleanup) mediaCalls += 1;
      const failFirst = !cleanup && mediaCalls === 1;
      await route.fulfill({
        status: failFirst ? 500 : 200,
        contentType: 'application/json',
        body: JSON.stringify(
          failFirst
            ? { error: 'RadioCult unavailable' }
            : cleanup
              ? { success: true, cleaned: true }
              : { success: true, radiocultMediaId: 'rc-2' }
        ),
      });
    });
    await openUploadMaster(page);

    await setUpShow(page.getByTestId('upload-job-1'), '2099-01-01', 'First Show');
    await page.getByRole('button', { name: 'Add another show' }).click();
    const second = page.getByTestId('upload-job-2');
    await second.getByLabel('Broadcast date').fill('2099-01-02');
    await second.getByPlaceholder('Search shows on this date').fill('Second Show');
    await second.getByText('Second Show').first().click();
    await second.locator('input[type="file"]').setInputFiles(MP3);

    await page.getByRole('button', { name: 'Upload 2 ready' }).click();

    await expect(page.getByTestId('upload-queue-summary')).toHaveText('1 uploaded, 1 failed', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('upload-job-1')).toContainText('Failed');
  });
});
