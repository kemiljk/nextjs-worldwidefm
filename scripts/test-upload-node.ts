import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise streaming with Node's HTTP implementation, as used by Vercel.
async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'wwfm-upload-tests-'));
  try {
    const result = await Bun.build({
      entrypoints: ['./test/node/upload-streaming.test.ts'],
      target: 'node',
      external: ['node:test'],
      outdir: directory,
      naming: 'upload-tests.mjs',
    });
    if (!result.success) throw new Error(result.logs.join('\n'));
    const tests = spawnSync('node', ['--test', join(directory, 'upload-tests.mjs')], {
      stdio: 'inherit',
    });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
void main();
