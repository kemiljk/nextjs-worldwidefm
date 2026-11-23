import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Runs the app against the real Cosmic bucket with read access only.
loadEnvConfig(process.cwd());
const bucket = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
const readKey = process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
if (!bucket || !readKey) {
  throw new Error('Live e2e needs NEXT_PUBLIC_COSMIC_BUCKET_SLUG and COSMIC_READ_KEY');
}
const port = 3100;

export default defineConfig({
  testDir: './test/e2e-live',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  webServer: {
    command: `bun run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_COSMIC_BUCKET_SLUG: bucket,
      COSMIC_READ_KEY: readKey,
      // Empty values stop Next loading write credentials from .env.local.
      COSMIC_WRITE_KEY: '',
      BLOB_READ_WRITE_TOKEN: '',
      GOOGLE_DRIVE_PRIVATE_KEY: '',
      MIXCLOUD_ACCESS_TOKEN: '',
      RADIOCULT_SECRET_KEY: '',
      RESEND_API_KEY: '',
      STRIPE_SECRET_KEY: '',
    },
  },
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
