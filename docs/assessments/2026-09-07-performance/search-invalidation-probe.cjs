const fs = require('node:fs');
(async () => {
  const origin = 'http://127.0.0.1:3102';
  const secret = process.env.REVALIDATION_SECRET;
  if (!secret) throw new Error('Local revalidation configuration required');
  const log = '/tmp/search-server-final.txt';
  const reads = () => fs.readFileSync(log, 'utf8').split('\n').filter(line => line.includes('"event":"cosmic.read"') && line.includes('"operation":"genres"')).length;
  await (await fetch(origin + '/api/search/filters')).arrayBuffer();
  const before = reads();
  const invalidate = await fetch(origin + '/api/revalidate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ object: { type: 'genres' } }),
  });
  if (!invalidate.ok) throw new Error(`Local invalidation failed: ${invalidate.status}`);
  const response = await fetch(origin + '/api/search/filters');
  await response.arrayBuffer();
  const result = { invalidationStatus: invalidate.status, filterStatus: response.status, additionalGenreReads: reads() - before };
  if (result.additionalGenreReads < 1) throw new Error('Expected a fresh genre read after invalidation');
  fs.writeFileSync(require('node:path').join(__dirname, 'search-invalidation-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exit(1); });
