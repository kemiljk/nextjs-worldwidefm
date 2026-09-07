const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const expectedStream = process.env.NEXT_PUBLIC_RADIOCULT_STREAM_URL;
  if (!expectedStream) throw new Error('Configured stream URL required');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.io = () => ({on(){},disconnect(){}});
      HTMLMediaElement.prototype.load = function() {};
      HTMLMediaElement.prototype.play = function() { return Promise.reject(new DOMException('Simulated playback denial','NotAllowedError')); };
    });
    await page.route('**/api/live/current', route => route.fulfill({json:{success:true,currentEvent:null,scheduleShow:null}}));
    await page.goto('http://127.0.0.1:3102/');
    const toggle=page.getByTestId('live-player-toggle');
    await toggle.click();
    const link=page.getByTestId('live-player-fallback-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href',expectedStream);
    await expect(toggle).toHaveAttribute('data-state','paused');
    const result={visibleRecoveryLink:true,hrefMatchesConfiguredStream:true,remainsPaused:true};
    fs.writeFileSync(require('node:path').join(__dirname,'playback-recovery-results.json'), JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
