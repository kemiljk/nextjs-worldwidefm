/**
 * Bounded exhaustive check of the Upload Master flow.
 *
 * Runs the real `runUploadMasterFlow` and the form's real `uploadFormOutcome`
 * once for every combination of endpoint answers in `OUTCOMES`, with and
 * without the Drive key. Each request is a choice point, so only requests the
 * flow actually sends multiply the trace count. See
 * .claude/skills/verify-upload-master-flow/SKILL.md.
 */
import type {
  UploadFetchFn,
  UploadFormOutcome,
  UploadMasterFlowInput,
  UploadMasterFlowResult,
} from '@/lib/upload-master-flow';

export type FlowModule = {
  runUploadMasterFlow: (input: UploadMasterFlowInput) => Promise<UploadMasterFlowResult>;
  buildUploadResultSummary: (result: UploadMasterFlowResult) => string;
};

export type Endpoint = 'mixcloud' | 'radiocult' | 'archive' | 'drive' | 'cleanup';

/** Every answer an endpoint can give in the model. */
export const OUTCOMES = [
  'ok',
  'okLinkNotSaved', // Mixcloud only: uploaded, but the route could not save the link.
  'rejected', // 400 with a JSON error.
  'gatewayHtml', // 502 with an HTML error page.
  'okNonJson', // 200 with an HTML page, as from a login wall or gateway.
  'okIncomplete', // 200 JSON without the id or URL that proves success.
  'network', // fetch rejects.
  'timeout', // fetch never answers until aborted.
] as const;
export type Outcome = (typeof OUTCOMES)[number];

// The archive and cleanup routes answer `{ success: true }` on success
// (app/api/episodes/[id]/archive/route.ts), so `okIncomplete` is `ok` there.
const outcomesFor = (endpoint: Endpoint): readonly Outcome[] =>
  OUTCOMES.filter(
    o =>
      (o !== 'okLinkNotSaved' || endpoint === 'mixcloud') &&
      (o !== 'okIncomplete' || (endpoint !== 'archive' && endpoint !== 'cleanup'))
  );

const isOk = (o: Outcome | undefined) => o === 'ok' || o === 'okLinkNotSaved';

export type Trace = {
  driveKey: boolean;
  answers: Partial<Record<Endpoint, Outcome>>;
  sent: Endpoint[];
  archiveBody?: Record<string, unknown>;
  result: UploadMasterFlowResult;
  outcome: UploadFormOutcome;
  summary: string;
};

export type Invariant = { name: string; meaning: string; holds: (t: Trace) => boolean };

const DESTINATIONS = { mixcloud: 'Mixcloud', radiocult: 'RadioCult', drive: 'Google Drive' };

/** Audio is on a destination only when that destination answered success. */
const delivered = (t: Trace) =>
  (['mixcloud', 'radiocult', 'drive'] as const).filter(e => isOk(t.answers[e]));

export const INVARIANTS: Invariant[] = [
  {
    name: 'clearsFormOnlyWithAudio',
    meaning:
      'The form clears the show and file only when the audio reached Mixcloud, RadioCult or Drive.',
    holds: t => t.outcome === 'failed' || delivered(t).length > 0,
  },
  {
    name: 'episodeUntouchedWithoutAudio',
    meaning:
      'The episode is PATCHed only after Mixcloud or RadioCult took the audio, and only with its reference.',
    holds: t =>
      !t.sent.includes('archive') ||
      ((isOk(t.answers.mixcloud) || isOk(t.answers.radiocult)) &&
        Boolean(
          t.archiveBody?.radiocult_media_id ||
            t.archiveBody?.mixcloud_pending_url ||
            t.archiveBody?.player
        )),
  },
  {
    name: 'retryStartsClean',
    meaning:
      'A failed attempt leaves the episode and raw audio as they were, so a retry starts from the same state.',
    holds: t =>
      t.outcome !== 'failed' || (!t.sent.includes('archive') && !t.sent.includes('cleanup')),
  },
  {
    name: 'rawAudioKeptOnAnyFailure',
    meaning: 'The raw audio is deleted only after every request the flow sent succeeded.',
    holds: t =>
      !t.sent.includes('cleanup') ||
      t.sent.filter(e => e !== 'cleanup').every(e => isOk(t.answers[e])),
  },
  {
    name: 'failuresAreReported',
    meaning:
      'Every failed destination, failed episode update and kept raw audio is in the summary.',
    holds: t =>
      (Object.keys(DESTINATIONS) as (keyof typeof DESTINATIONS)[]).every(
        e =>
          !t.sent.includes(e) ||
          isOk(t.answers[e]) ||
          t.summary.includes(`${DESTINATIONS[e]}: failed`)
      ) &&
      (!t.sent.includes('archive') ||
        t.answers.archive === 'ok' ||
        t.summary.includes('Website archive: failed')) &&
      (t.sent.includes('cleanup') || t.summary.includes('Raw audio kept at')),
  },
  {
    name: 'completeMeansEverywhere',
    meaning: 'The form says "uploaded and episode updated" only when every request succeeded.',
    holds: t =>
      t.outcome !== 'complete' ||
      (isOk(t.answers.mixcloud) &&
        isOk(t.answers.radiocult) &&
        t.answers.archive === 'ok' &&
        (!t.driveKey || isOk(t.answers.drive))),
  },
];

const BASE_INPUT = {
  blobUrl: 'https://blob.vercel-storage.com/media/master.mp3',
  mediaFileName: 'master.mp3',
  episodeId: 'episode-1',
  episodeSlug: 'test-episode',
  mixcloudTitle: 'Test Show // 29-07-26',
  mixcloudTags: ['WorldWide FM'],
  mixcloudDescription: 'Description',
  mixcloudHostUsernames: ['worldwidefm'],
  broadcastDate: '2026-07-29',
  broadcastTime: '18:00',
  duration: '120',
  radiocultMetadata: { title: 'master', artist: 'Host' },
  regularHostIds: ['host-1'],
  clientTimeoutMs: 1,
};

function endpointOf(url: string, init?: RequestInit): Endpoint {
  if (url === '/api/upload-mixcloud') return 'mixcloud';
  if (url === '/api/upload-drive') return 'drive';
  if (url === '/api/episodes/episode-1/archive') return 'archive';
  if (url === '/api/upload-media') {
    return init?.body instanceof FormData && init.body.get('cleanupOnly') === 'true'
      ? 'cleanup'
      : 'radiocult';
  }
  throw new Error(`Model does not know the request ${url}. Add it to endpointOf.`);
}

const SUCCESS_BODY: Record<Endpoint, Record<string, unknown>> = {
  mixcloud: {
    success: true,
    url: 'https://www.mixcloud.com/worldwidefm/test/',
    episodeUpdated: true,
  },
  radiocult: { success: true, radiocultMediaId: 'rc-1' },
  archive: { success: true },
  drive: { success: true, fileId: 'drive-1' },
  cleanup: { success: true },
};

function answer(
  endpoint: Endpoint,
  outcome: Outcome,
  signal?: AbortSignal | null
): Promise<Response> {
  switch (outcome) {
    case 'ok':
      return Promise.resolve(Response.json(SUCCESS_BODY[endpoint]));
    case 'okLinkNotSaved':
      return Promise.resolve(Response.json({ ...SUCCESS_BODY[endpoint], episodeUpdated: false }));
    case 'rejected':
      return Promise.resolve(Response.json({ error: `${endpoint} rejected` }, { status: 400 }));
    case 'gatewayHtml':
      return Promise.resolve(
        new Response('<!DOCTYPE html><html>Bad gateway</html>', { status: 502 })
      );
    case 'okNonJson':
      return Promise.resolve(new Response('<html>login</html>', { status: 200 }));
    case 'okIncomplete':
      return Promise.resolve(Response.json({ success: true }));
    case 'network':
      return Promise.reject(new TypeError('fetch failed'));
    case 'timeout':
      return new Promise((_, reject) => {
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      });
  }
}

/** Depth-first enumeration over choice points; returns every trace. */
export async function exploreFlow(
  flow: FlowModule,
  decide: (result: UploadMasterFlowResult) => UploadFormOutcome
): Promise<Trace[]> {
  const traces: Trace[] = [];
  let prefix: number[] = [];
  for (;;) {
    const taken: { choice: number; width: number }[] = [];
    const choose = (width: number) => {
      const choice = prefix[taken.length] ?? 0;
      taken.push({ choice, width });
      return choice;
    };

    const driveKey = choose(2) === 1;
    const answers: Trace['answers'] = {};
    const sent: Endpoint[] = [];
    let archiveBody: Record<string, unknown> | undefined;
    const fetchFn: UploadFetchFn = async (url, init) => {
      const endpoint = endpointOf(String(url), init);
      const options = outcomesFor(endpoint);
      const outcome = options[choose(options.length)];
      sent.push(endpoint);
      answers[endpoint] = outcome;
      if (endpoint === 'archive') archiveBody = JSON.parse(String(init?.body));
      return answer(endpoint, outcome, init?.signal);
    };

    const result = await flow.runUploadMasterFlow({
      ...BASE_INPUT,
      driveAccessKey: driveKey ? 'staff-key' : undefined,
      fetchFn,
    });
    traces.push({
      driveKey,
      answers,
      sent,
      archiveBody,
      result,
      outcome: decide(result),
      summary: flow.buildUploadResultSummary(result),
    });

    let i = taken.length - 1;
    while (i >= 0 && taken[i].choice + 1 >= taken[i].width) i--;
    if (i < 0) return traces;
    prefix = [...taken.slice(0, i).map(t => t.choice), taken[i].choice + 1];
  }
}

export type Violation = { invariant: Invariant; trace: Trace };

/** Shortest counterexample per invariant, in the order the flow sends requests. */
export function checkInvariants(traces: Trace[]): Violation[] {
  const violations: Violation[] = [];
  for (const invariant of INVARIANTS) {
    const failing = traces.filter(t => !invariant.holds(t));
    if (failing.length === 0) continue;
    failing.sort(
      (a, b) => a.sent.length - b.sent.length || Number(a.driveKey) - Number(b.driveKey)
    );
    violations.push({ invariant, trace: failing[0] });
  }
  return violations;
}

/** A counterexample in the flow's own words. */
export function describeTrace(t: Trace): string {
  const steps = t.sent.map((e, i) => `  ${i + 1}. ${e} answers ${t.answers[e]}`);
  return [
    `  Drive key: ${t.driveKey ? 'given' : 'not given'}`,
    ...steps,
    ...(t.archiveBody ? [`  archive PATCH body: ${JSON.stringify(t.archiveBody)}`] : []),
    `  form outcome: ${t.outcome} (${t.outcome === 'failed' ? 'keeps show and file' : 'clears show and file'})`,
    `  summary: ${t.summary}`,
  ].join('\n');
}
