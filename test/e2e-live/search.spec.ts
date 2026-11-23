import { expect, test, type Page } from '@playwright/test';

// Archive episodes outlive any single listing, so these assert properties of the results
// rather than exact titles. Each query is nonempty in the live archive.
const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').replace(/ø/gi, 'o').toLowerCase();

async function searchEpisodes(page: Page, query: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open search' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Latest Shows' }).click();
  const response = page.waitForResponse(response => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/search' &&
      url.searchParams.get('type') === 'episodes' &&
      url.searchParams.get('q') === query
    );
  });
  await dialog.getByPlaceholder('Search').filter({ visible: true }).fill(query);
  expect((await response).status()).toBe(200);
  await expect(dialog.locator('[aria-busy="false"]')).toBeVisible();
  const titles = dialog.locator('a[href^="/episode/"] h3').filter({ visible: true });
  await expect(titles.first()).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  return titles.allTextContents();
}

test('a single-word search returns only matching episodes', async ({ page }) => {
  // Also the 7a11c3f regression: literal \u escapes made Cosmic return 500 for any word.
  const titles = await searchEpisodes(page, 'Gilles');
  for (const title of titles) expect(fold(title)).toContain('gilles');
});

test('a multi-word search matches every word, in any order, not the whole archive', async ({
  page,
}) => {
  // bbdc357: Cosmic drops "$and" beside the broadcast date filter, which returned every
  // episode. Before that, the whole term was one substring and this found nothing.
  const titles = await searchEpisodes(page, 'Jazz Gilles');
  for (const title of titles) {
    expect(fold(title)).toContain('gilles');
    expect(fold(title)).toContain('jazz');
  }
});

test('an unaccented search finds accented titles', async ({ page }) => {
  const titles = await searchEpisodes(page, 'okse');
  for (const title of titles) expect(fold(title)).toContain('okse');
  expect(titles.some(title => /ø/i.test(title))).toBe(true);
});
