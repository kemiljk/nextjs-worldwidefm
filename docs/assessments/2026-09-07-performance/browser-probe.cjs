const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1440,height:1000}, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    if (mobile) {
      await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
      await cdp.send('Network.emulateNetworkConditions', {offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
    }
    const requests = new Map();
    const errors = [];
    cdp.on('Network.requestWillBeSent', e => { const u = new URL(e.request.url); requests.set(e.requestId, {host:u.hostname,path:u.pathname,type:e.type}); });
    cdp.on('Network.responseReceived', e => { Object.assign(requests.get(e.requestId)||{}, {status:e.response.status}); });
    cdp.on('Network.loadingFinished', e => { Object.assign(requests.get(e.requestId)||{}, {bytes:e.encodedDataLength}); });
    page.on('pageerror', e => errors.push(e.message.slice(0,200)));
    await page.addInitScript(() => {
      window.audit = {lcp:0,cls:0,shiftSum:0,shifts:[],longTasks:0,longTaskMs:0}; let sessionStart=0,lastShift=0,sessionScore=0;
      new PerformanceObserver(l => {for(const e of l.getEntries()) window.audit.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(l => {for(const e of l.getEntries()) if(!e.hadRecentInput) {if(e.startTime-lastShift>1000 || e.startTime-sessionStart>5000){sessionStart=e.startTime;sessionScore=0;} lastShift=e.startTime;sessionScore+=e.value;window.audit.cls=Math.max(window.audit.cls,sessionScore);window.audit.shiftSum+=e.value;window.audit.shifts.push({at:e.startTime,value:e.value,sources:e.sources?.map(s=>({tag:s.node?.tagName,cls:s.node?.className,previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))});}}).observe({type:'layout-shift',buffered:true});
      new PerformanceObserver(l => {for(const e of l.getEntries()){window.audit.longTasks++;window.audit.longTaskMs+=e.duration;}}).observe({type:'longtask',buffered:true});
    });
    await page.goto('https://www.worldwidefm.net/', {waitUntil:'load',timeout:60000});
    await page.waitForTimeout(8000);
    const metrics = await page.evaluate(() => ({...window.audit,navigation:performance.getEntriesByType('navigation').map(e=>({ttfb:e.responseStart,dcl:e.domContentLoadedEventEnd,load:e.loadEventEnd,encodedBody:e.encodedBodySize,decodedBody:e.decodedBodySize})),domNodes:document.querySelectorAll('*').length,images:document.images.length,loadedImages:[...document.images].filter(i=>i.complete&&i.naturalWidth).length,imageSamples:[...document.images].filter(i=>i.complete&&i.naturalWidth&&i.getBoundingClientRect().width>0).slice(0,8).map(i=>({width:i.getBoundingClientRect().width,naturalWidth:i.naturalWidth,url:i.currentSrc,loading:i.loading})),buttons:[...document.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label'),text:b.textContent.trim().slice(0,40)})).filter(b=>b.label||b.text).slice(0,15)}));
    const grouped = {};
    for(const r of requests.values()){const key=r.host; grouped[key]??={requests:0,bytes:0};grouped[key].requests++;grouped[key].bytes+=r.bytes||0;}
    results.push({mode:mobile?'mobile-simulated-4xCPU-1.6Mbps-150ms':'desktop-unthrottled',metrics,grouped,cosmicRequests:[...requests.values()].filter(r=>r.host==='api.cosmicjs.com'),errors,resourceTypes:[...requests.values()].reduce((a,r)=>{a[r.type]??={count:0,bytes:0};a[r.type].count++;a[r.type].bytes+=r.bytes||0;return a;},{})});
    if(!mobile){const before=requests.size; const search=page.locator('button:has(svg.lucide-search)').filter({visible:true}).first(); if(await search.count()){await search.click();await page.waitForTimeout(5000);results[results.length-1].searchRequests=[...requests.values()].slice(before);}}
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(require('path').join(__dirname, 'browser-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
