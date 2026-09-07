import { spawnSync } from 'node:child_process';

// Bun module mocks persist across files in a single process. Isolate suites so an
// upload-route mock cannot replace the SDK used by an unrelated search/cache test.
async function main() {
  const files = Array.from(new Bun.Glob('test/*.test.ts').scanSync('.')).sort();
  let failed = 0;
  for (const file of files) {
    const result = spawnSync(process.execPath, ['test', file], { stdio: 'inherit' });
    if (result.status !== 0) failed++;
  }
  console.log(`\n${files.length - failed}/${files.length} isolated test suites passed`);
  process.exitCode = failed ? 1 : 0;
}

void main();
