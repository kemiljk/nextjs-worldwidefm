import { expect, test, type Page } from '@playwright/test';

const MP3 = {
  name: 'master.mp3',
  mimeType: 'audio/mpeg',
  buffer: Buffer.from([
    0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]),
};

async function mockBackend(page: Page, notes: string) {
  const tagged: string[][] = [];

  await page.route('**/api/live/current**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, currentEvent: null, scheduleShow: null }),
    })
  );
  await page.route('**/api/episodes/by-date**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        episodes: [
          {
            id: 'episode-1',
            slug: 'episode-1',
            title: 'Tag Show',
            metadata: {
              broadcast_date: '2099-01-01',
              broadcast_time: '18:00',
              duration: '120',
              mixcloud_submission_notes: notes,
            },
          },
        ],
      }),
    })
  );
  await page.route('**/api/upload-mixcloud', async route => {
    const body = route.request().postDataBuffer()?.toString() ?? '';
    const match = /name="hosts"\r\n\r\n(\[.*?\])\r\n/.exec(body);
    tagged.push(match ? JSON.parse(match[1]) : []);
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
  return tagged;
}

test('usernames from the submission form can be tagged without a host profile', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const tagged = await mockBackend(
    page,
    'Jo @jo_bloggs and Sam https://www.mixcloud.com/Sam-S/ email sam@example.com'
  );
  const hydrated = page.waitForResponse('**/api/live/current**');
  await page.goto('/upload-master');
  await hydrated;

  const job = page.getByTestId('upload-job-1');
  await job.getByLabel('Broadcast date').fill('2099-01-01');
  await job.getByPlaceholder('Search shows on this date').fill('Tag Show');
  await job.getByText('Tag Show').first().click();
  await job.locator('input[type="file"]').setInputFiles(MP3);

  const link = job.getByRole('checkbox', { name: '@Sam-S' });
  const handle = job.getByRole('checkbox', { name: /@jo_bloggs/ });
  await expect(link).toBeChecked();
  await expect(handle).not.toBeChecked();
  await expect(job.getByRole('checkbox')).toHaveCount(2);

  await handle.check();
  await job
    .getByRole('button', { name: /^Upload/ })
    .first()
    .click();
  await expect(job).toContainText('Last upload: Tag Show', { timeout: 30_000 });
  expect(tagged).toHaveLength(1);
  expect(new Set(tagged[0])).toEqual(new Set(['jo_bloggs', 'Sam-S']));
});
