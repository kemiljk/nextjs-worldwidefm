import { expect, test } from '@playwright/test';
import { DEFERRED_IMAGE_PLACEHOLDER } from '../../components/ui/near-viewport-image';

test('the deferred artwork placeholder decodes before real artwork is requested', async ({
  page,
}) => {
  const size = await page.evaluate(async src => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, DEFERRED_IMAGE_PLACEHOLDER);
  expect(size).toEqual({ width: 1, height: 1 });
});
