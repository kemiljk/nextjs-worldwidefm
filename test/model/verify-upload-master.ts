/**
 * Replays the Upload Master bounded check against three kinds of code:
 *   1. the current flow, which must satisfy every invariant;
 *   2. the flow before a7f9197 (verbatim, blob b02147e), which must break the
 *      invariants the historical partial-failure bug broke, and the flow at
 *      a7f9197 (blob 3b766a0), which must hold them;
 *   3. small mutants of the current flow, so each invariant is seen to fail.
 * Run with `bun run verify:upload-master`.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as current from '@/lib/upload-master-flow';
import {
  checkInvariants,
  describeTrace,
  exploreFlow,
  INVARIANTS,
  type FlowModule,
} from './upload-master-model';

type Replay = {
  name: string;
  source: () => Promise<string>;
  /** Invariants this code must break. Empty means it must pass. */
  expectBroken: string[];
  /** With `expectBroken`, invariants that must still hold. */
  expectHeld?: string[];
};

const ROOT = join(import.meta.dir, '..', '..');
const FLOW = join(ROOT, 'lib', 'upload-master-flow.ts');
const HISTORICAL = {
  preFix: ['upload-master-flow.pre-a7f9197.ts.txt', 'b02147ed87d5fa96f4e3f2e38aac3c6ed6481ce1'],
  fix: ['upload-master-flow.a7f9197.ts.txt', '3b766a028176f1db2cf5ea27e4f1bbb981de700e'],
} as const;
const TARGET_BUG = ['clearsFormOnlyWithAudio', 'episodeUntouchedWithoutAudio', 'retryStartsClean'];
// Inside the repo so the `@/` path alias resolves for replayed copies.
const REPLAY_DIR = join(import.meta.dir, '.replay');

async function mutate(replacements: [from: string, to: string][]): Promise<string> {
  let source = await readFile(FLOW, 'utf8');
  for (const [from, to] of replacements) {
    const count = source.split(from).length - 1;
    if (count !== 1) {
      throw new Error(`Mutant anchor found ${count} times, expected once: ${from}`);
    }
    source = source.replace(from, to);
  }
  return source;
}

/** A historical copy of the flow, checked byte-for-byte against its git blob. */
async function historical([file, expected]: readonly [string, string]): Promise<string> {
  const source = await readFile(join(import.meta.dir, file), 'utf8');
  const blob = createHash('sha1')
    .update(`blob ${Buffer.byteLength(source)}\0`)
    .update(source)
    .digest('hex');
  if (blob !== expected) {
    throw new Error(`${file} is not git blob ${expected} (got ${blob})`);
  }
  return source;
}

const REPLAYS: Replay[] = [
  {
    name: 'current lib/upload-master-flow.ts',
    source: () => readFile(FLOW, 'utf8'),
    expectBroken: [],
  },
  {
    name: 'pre-fix flow (a7f9197^)',
    source: () => historical(HISTORICAL.preFix),
    expectBroken: TARGET_BUG,
  },
  {
    // The fix commit predates later fixes for non-JSON 200 answers, so other invariants may break.
    name: 'fix commit flow (a7f9197)',
    source: () => historical(HISTORICAL.fix),
    expectBroken: [],
    expectHeld: TARGET_BUG,
  },
  {
    name: 'mutant: archive PATCH sent without audio',
    source: () => mutate([['if (radiocultMediaId || mixcloudUrl) {', 'if (true) {']]),
    expectBroken: ['episodeUntouchedWithoutAudio', 'retryStartsClean'],
  },
  {
    name: 'mutant: form always clears',
    source: () =>
      mutate([["return result.hasAnySuccess ? 'partial' : 'failed';", "return 'partial';"]]),
    expectBroken: ['clearsFormOnlyWithAudio'],
  },
  {
    name: 'mutant: raw audio deleted after an archive failure',
    source: () =>
      mutate([
        [
          'const shouldCleanupBlob = !mixcloudError && !radioCultError && !archiveError && !driveError;',
          'const shouldCleanupBlob = !mixcloudError && !radioCultError && !driveError;',
        ],
      ]),
    expectBroken: ['rawAudioKeptOnAnyFailure'],
  },
  {
    name: 'mutant: RadioCult failure left out of the summary',
    source: () => mutate([['parts.push(`RadioCult: failed (${result.radioCultError})`);', '']]),
    expectBroken: ['failuresAreReported'],
  },
  {
    name: 'mutant: Drive failure ignored by "complete"',
    source: () =>
      mutate([
        ['    !result.radioCultError &&\n    !result.driveError\n', '    !result.radioCultError\n'],
      ]),
    expectBroken: ['completeMeansEverywhere'],
  },
];

async function main() {
  await rm(REPLAY_DIR, { recursive: true, force: true });
  await mkdir(REPLAY_DIR, { recursive: true });
  let unexpected = 0;
  try {
    for (const [index, replay] of REPLAYS.entries()) {
      const file = join(REPLAY_DIR, `flow-${index}.ts`);
      await writeFile(file, await replay.source());
      const flow = (await import(file)) as FlowModule & Partial<typeof current>;
      // The pre-fix module predates `uploadFormOutcome`. Its inline form logic
      // was this function without the Drive clause, and its results carry no Drive fields.
      const decide = flow.uploadFormOutcome ?? current.uploadFormOutcome;
      const traces = await exploreFlow(flow, decide);
      const broken = checkInvariants(traces);
      const brokenNames = broken.map(v => v.invariant.name);
      const missing = replay.expectBroken.filter(name => !brokenNames.includes(name));
      // Without `expectHeld`, an empty `expectBroken` means every invariant must hold.
      const mustHold =
        replay.expectHeld ?? (replay.expectBroken.length ? [] : INVARIANTS.map(i => i.name));
      const unexpectedlyBroken = brokenNames.filter(name => mustHold.includes(name));
      const ok = missing.length === 0 && unexpectedlyBroken.length === 0;
      if (!ok) unexpected++;

      console.log(`\n${ok ? 'AS EXPECTED' : 'UNEXPECTED'}  ${replay.name}`);
      console.log(
        `  ${traces.length} traces, ${INVARIANTS.length} invariants, ${broken.length} broken`
      );
      if (missing.length) console.log(`  expected to break but held: ${missing.join(', ')}`);
      if (unexpectedlyBroken.length)
        console.log(`  expected to hold but broke: ${unexpectedlyBroken.join(', ')}`);
      for (const { invariant, trace } of broken) {
        console.log(`  BROKEN ${invariant.name}: ${invariant.meaning}`);
        console.log(describeTrace(trace).replace(/^/gm, '  '));
      }
    }
  } finally {
    await rm(REPLAY_DIR, { recursive: true, force: true });
  }
  console.log(`\n${REPLAYS.length - unexpected}/${REPLAYS.length} replays as expected`);
  process.exitCode = unexpected ? 1 : 0;
}

void main();
