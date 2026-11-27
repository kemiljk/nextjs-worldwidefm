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

test('submission form shows typed text in the case it was entered', async ({ page }) => {
  await page.goto('/add-show');
  const title = page.getByPlaceholder('Enter show title');
  await title.fill('Luke Una: The Heat Is On');
  await expect(title).toHaveValue('Luke Una: The Heat Is On');
  // CSS must not upper-case what was typed, or staff cannot check the casing that gets saved.
  await expect(title).toHaveCSS('text-transform', 'none');
});
