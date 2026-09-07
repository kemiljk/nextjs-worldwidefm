const { webkit, chromium, expect } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const results = [];
  for (const [engineName, engine] of [
    ['webkit', webkit],
    ['chromium', chromium],
  ]) {
    const browser = await engine.launch();
    for (const mobile of [true, false]) {
      const page = await browser.newPage({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        colorScheme: 'dark',
      });
      await page.addInitScript(() => {
        window.io = () => ({ on() {}, disconnect() {} });
      });
      await page.goto('http://127.0.0.1:3102/', { waitUntil: 'domcontentloaded' });
      for (const title of ['LATEST SHOWS', 'FROM THE ARCHIVE', 'LISTEN BY GENRE']) {
        const section = page
          .locator('section')
          .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
          .first();
        await expect(section).toBeAttached();
        const images = await section.locator('img').elementHandles();
        const record = { engine: engineName, mobile, section: title, checked: 0, failures: [] };
        for (const img of images) {
          const box = await img.boundingBox();
          if (!box || !box.width || !box.height) continue;
          await img.scrollIntoViewIfNeeded({ timeout: 10000 });
          try {
            await expect
              .poll(
                () =>
                  img.evaluate(
                    i =>
                      i.complete &&
                      i.naturalWidth > 1 &&
                      !i.currentSrc.startsWith('data:') &&
                      !i.currentSrc.includes('/image-placeholder.png')
                  ),
                { timeout: 12000 }
              )
              .toBe(true);
            record.checked++;
          } catch {
            record.failures.push(await img.evaluate(i => ({ alt: i.alt, src: i.currentSrc })));
          }
        }
        results.push(record);
        console.log(JSON.stringify(record));
      }
      await page.goto('http://127.0.0.1:3102/shows?type=hosts-series', {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForTimeout(1500);
      const images = await page.locator('main img').elementHandles();
      const record = {
        engine: engineName,
        mobile,
        section: 'HOSTS & SERIES',
        checked: 0,
        failures: [],
      };
      for (const img of images.slice(0, 20)) {
        const box = await img.boundingBox();
        if (!box || !box.width || !box.height) continue;
        await img.scrollIntoViewIfNeeded({ timeout: 10000 });
        try {
          await expect
            .poll(
              () =>
                img.evaluate(
                  i =>
                    i.complete &&
                    i.naturalWidth > 1 &&
                    !i.currentSrc.startsWith('data:') &&
                    !i.currentSrc.includes('/image-placeholder.png')
                ),
              { timeout: 12000 }
            )
            .toBe(true);
          record.checked++;
        } catch {
          record.failures.push(await img.evaluate(i => ({ alt: i.alt, src: i.currentSrc })));
        }
      }
      results.push(record);
      console.log(JSON.stringify(record));
      await page.close();
    }
    await browser.close();
  }
  fs.writeFileSync(__dirname + '/verified.json', JSON.stringify(results, null, 2));
  if (results.some(r => r.failures.length || !r.checked)) process.exitCode = 1;
})().catch(e => {
  console.error(e);
  process.exit(1);
});
