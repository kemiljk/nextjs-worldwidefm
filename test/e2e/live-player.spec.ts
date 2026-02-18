import { test, expect } from '@playwright/test';

const installSocketStub = () => {
  (window as any).__socketHandlers = {};
  (window as any).io = () => ({
    on: (event: string, callback: (data?: unknown) => void) => {
      (window as any).__socketHandlers[event] = callback;
      if (event === 'connect') {
        setTimeout(() => callback(), 0);
      }
    },
    disconnect: () => {},
    readyState: 1,
  });
  (window as any).__emitPlayerMetadata = (data: unknown) => {
    const handler = (window as any).__socketHandlers?.['player-metadata'];
    if (handler) handler(data);
  };
};

const installMediaStubs = () => {
  (window as any).__playCount = 0;
  (window as any).__pauseCount = 0;
  (window as any).__loadCount = 0;

  const originalPause = HTMLMediaElement.prototype.pause;

  HTMLMediaElement.prototype.pause = function () {
    (window as any).__pauseCount += 1;
    return originalPause.call(this);
  };

  HTMLMediaElement.prototype.load = function () {
    (window as any).__loadCount += 1;
  };
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSocketStub);
  await page.addInitScript(installMediaStubs);

  await page.route('**/api/live/current', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        currentEvent: null,
        matchingShowSlug: null,
        isLive: false,
      }),
    })
  );
});

test('plays without metadata and shows generic label', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      (window as any).__playCount += 1;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });

  await page.goto('/');

  const label = page.getByTestId('live-player-label');
  await expect(label).toHaveText(/live stream/i);

  const toggle = page.getByTestId('live-player-toggle');
  await toggle.click();

  await expect(toggle).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('live-player-fallback-link')).toHaveCount(0);

  const playCount = await page.evaluate(() => (window as any).__playCount);
  expect(playCount).toBe(1);
});

test('shows fallback link on playback failure', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      (window as any).__playCount += 1;
      const error = new Error('NotAllowedError');
      (error as any).name = 'NotAllowedError';
      return Promise.reject(error);
    };
  });

  await page.goto('/');

  const toggle = page.getByTestId('live-player-toggle');
  await toggle.click();

  const fallback = page.getByTestId('live-player-fallback-link');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute('href', 'https://example.com/stream');
  await expect(toggle).toHaveAttribute('data-state', 'paused');
});

test('metadata updates do not pause playback', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      (window as any).__playCount += 1;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });

  await page.goto('/');

  const toggle = page.getByTestId('live-player-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-state', 'playing');

  await page.evaluate(() => {
    (window as any).__pauseCount = 0;
  });

  await page.evaluate(() => {
    (window as any).__emitPlayerMetadata({
      content: { name: 'Test Show', artist: 'Test Artist' },
      metadata: { title: 'Track' },
    });
  });

  const label = page.getByTestId('live-player-label');
  await expect(label).toHaveText(/test show/i);

  const pauseCount = await page.evaluate(() => (window as any).__pauseCount);
  expect(pauseCount).toBe(0);
  await expect(toggle).toHaveAttribute('data-state', 'playing');
});

test('slow connection shows loading state before playing', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      (window as any).__playCount += 1;
      return new Promise<void>(resolve => {
        setTimeout(() => {
          this.dispatchEvent(new Event('playing'));
          resolve();
        }, 1200);
      });
    };
  });

  await page.goto('/');

  const toggle = page.getByTestId('live-player-toggle');
  await toggle.click();

  await expect(toggle).toHaveAttribute('data-loading', 'true');
  await expect(toggle).toHaveAttribute('data-loading', 'false');
});
