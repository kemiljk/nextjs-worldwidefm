const fs = require('node:fs');
const path = require('node:path');
const origin = 'http://127.0.0.1:3102';
const routes = ['/', '/api/live/current', '/api/search?q=gilles', '/api/search/filters'];
const log = '/tmp/perf-second-server-final.txt';
const readCount = () => fs.readFileSync(log, 'utf8').split('\n').filter(line => line.includes('"event":"cosmic.read"')).length;
async function request(route) {
  const start = performance.now();
  const response = await fetch(origin + route, {signal:AbortSignal.timeout(15000)});
  const body = await response.text();
  if (!response.ok) throw new Error(`${route}: ${response.status}`);
  if (route === '/api/live/current' && !JSON.parse(body).success) throw new Error('Live metadata failed');
  return {route, ms:performance.now()-start, bytes:Buffer.byteLength(body)};
}
(async () => {
  for (const route of routes) await request(route);
  const before = readCount();
  const results = [];
  let next = 0;
  const start = performance.now();
  await Promise.all(Array.from({length:20}, async () => {
    for (;;) {
      const index = next++;
      if(index >= 160) return;
      results.push(await request(routes[index % routes.length]));
    }
  }));
  const elapsedMs = performance.now()-start;
  const timings = results.map(result=>result.ms).sort((a,b)=>a-b);
  const result = {
    scope:'Bounded local warm-cache test; not a production capacity or latency guarantee',
    concurrency:20,requests:results.length,elapsedMs:Math.round(elapsedMs),
    medianMs:Math.round(timings[Math.floor(timings.length*0.5)]),p95Ms:Math.round(timings[Math.floor(timings.length*0.95)]),
    additionalCosmicReads:readCount()-before,
    responseBytes:results.reduce((sum,item)=>sum+item.bytes,0),
  };
  fs.writeFileSync(path.join(__dirname,'load-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exit(1);});
