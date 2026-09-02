import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  webServer: {
    command: 'bun run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_COSMIC_BUCKET_SLUG: 'e2e-test',
      NEXT_PUBLIC_COSMIC_READ_KEY: 'e2e-test',
      COSMIC_WRITE_KEY: 'e2e-test',
      NEXT_PUBLIC_RADIOCULT_STREAM_URL: 'https://example.com/stream',
      NEXT_PUBLIC_RADIOCULT_STATION_ID: 'test-station',
      NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY: 'test-key',
      NEXT_PUBLIC_LIVE_CURRENT_POLL_MS: '100',
      NEXT_PUBLIC_E2E_FAKE_BLOB_URL:
        'https://example.public.blob.vercel-storage.com/media/master.mp3',
      NEXT_PUBLIC_E2E_UPLOAD_CLIENT_TIMEOUT_MS: '3000',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
