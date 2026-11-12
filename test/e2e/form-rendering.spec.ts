import { expect, test } from '@playwright/test';

for (const [path, heading, field] of [
  ['/add-show', 'Add Show', 'input'],
  ['/upload-master', 'Upload Mastered Audio', '#broadcast-date'],
] as const) {
  test(`${heading} renders after browser hydration`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator(field).first()).toBeVisible();
    // Wait for hydration and its effects, which is when client import errors appear.
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
