---
name: verify-upload-master-flow
description: Check a change to the Upload Master flow against its bounded model of partial failures and retries. Use when editing lib/upload-master-flow.ts, the upload-master form's submit handling, the archive PATCH route, or lib/upload-fetch.ts, or when asked whether a failed master upload can still be retried.
---

# Verify the Upload Master flow

Staff upload a mastered file once, and the flow sends it to Mixcloud, RadioCult and, if a key is given, Google Drive. It then PATCHes the episode and deletes the raw audio. The **promise** is that a partial or total failure never looks like success, never touches the episode without audio, and never loses the only copy of the file. The **harm** when it breaks is that a show's audio silently never reaches listeners, and staff have nothing to retry with.

This happened once. Before `a7f9197`, if both Mixcloud and RadioCult failed, the flow still sent a host-only PATCH. That made `hasAnySuccess` true, so the form cleared the show and file as if the upload had worked.

## Run it

```sh
bun run verify:upload-master
```

The run takes about 7 seconds. CI runs it as the last step of `.github/workflows/ci.yml`. It exits 0 only when all of these replays come out as expected:

| Replay | Expected |
| --- | --- |
| current `lib/upload-master-flow.ts` | every invariant holds |
| pre-fix flow (`a7f9197^`, fixture `test/model/upload-master-flow.pre-a7f9197.ts.txt`) | breaks `clearsFormOnlyWithAudio`, `episodeUntouchedWithoutAudio`, `retryStartsClean` |
| fix commit flow (`a7f9197`, fixture `test/model/upload-master-flow.a7f9197.ts.txt`) | holds those three. Its other breaks come from non-JSON 200 answers, fixed later in `aff298b` |
| five mutants of the current file | each breaks the one invariant it targets |

Each fixture is checked byte-for-byte against its git blob, so never reformat or edit them.

## What is checked

`test/model/upload-master-model.ts` runs the real `runUploadMasterFlow`, `buildUploadResultSummary` and `uploadFormOutcome`. It uses a scripted `fetchFn`. Every request the flow sends is a choice point that can answer `ok`, `okLinkNotSaved` (Mixcloud only), `rejected` (400 JSON), `gatewayHtml` (502 HTML), `okNonJson` (200 HTML), `okIncomplete` (200 JSON without an id, not for archive or cleanup), `network` or `timeout`. Every combination is enumerated, with and without the Drive key, which gives 1,268 traces today.

| Invariant | In plain words |
| --- | --- |
| `clearsFormOnlyWithAudio` | The form clears the show and file only if Mixcloud, RadioCult or Drive actually took the audio. |
| `episodeUntouchedWithoutAudio` | The episode is PATCHed only after Mixcloud or RadioCult took the audio, and the body carries its reference. |
| `retryStartsClean` | A `failed` outcome sent no PATCH and no cleanup, so the retry starts from the same state. |
| `rawAudioKeptOnAnyFailure` | Cleanup is sent only if every earlier request succeeded. |
| `failuresAreReported` | The summary names each failed destination, a failed archive update, and the kept raw audio. |
| `completeMeansEverywhere` | `complete` ("uploaded and episode updated") only when every request succeeded. |

**Why one attempt covers retries.** `retryStartsClean` says a failed attempt leaves the episode and raw audio unchanged. A retry is then the same check from the same state, so by induction the bound covers any number of retries. That argument holds only while `retryStartsClean` passes.

**Not covered:** the API routes' server-side behaviour beyond the answers above, `fetchWithBodyRetry` inside the routes, the Blob upload before the flow starts, the Drive-only `retryMasterToDrive` path, React rendering (the E2E test `test/e2e/upload-master.spec.ts` covers the both-fail case in a browser), two tabs uploading at once, and a page closed mid-flow. The pre-fix replay uses today's `uploadFormOutcome`. The form's inline logic then was the same function without the Drive clause, and pre-fix results have no Drive fields.

## Reading a failure

Each broken invariant prints its shortest counterexample as numbered requests, for example `1. mixcloud answers rejected 2. radiocult answers rejected 3. archive answers ok`, then the PATCH body, the form outcome and the summary. Ask whether the production code would really do that given those answers:

- **Real bug.** The trace is possible and the outcome harms staff, for example the form clears with no audio delivered. Fix the product code. Do not weaken the invariant.
- **Modelling error.** The model gives an answer the route can never give, or calls a valid answer a failure. For example, the archive route's success body is `{ success: true }`, which is why `okIncomplete` is excluded there. Fix `outcomesFor`, `SUCCESS_BODY` or `endpointOf` in the model, and cite the route line that justifies the change.
- `Model does not know the request …` means the flow calls a new endpoint. Add it to `endpointOf` and decide which invariants it joins.
- `Mutant anchor found 0 times` means you edited a line a mutant targets. Update that mutant in `test/model/verify-upload-master.ts` so it still breaks the same behaviour.

## Coverage and sync

| Code | What the model relies on |
| --- | --- |
| `lib/upload-master-flow.ts`: `runUploadMasterFlow`, `uploadFormOutcome`, `buildUploadResultSummary` | Run directly |
| `lib/upload-fetch.ts`: `fetchWithBody`, `withUploadTimeout` | Run directly. Timeouts abort the scripted fetch |
| `app/upload-master/upload-master-form.tsx`: `handleSubmit` | Clears the form unless `uploadFormOutcome` is `failed` |
| `app/api/episodes/[id]/archive/route.ts` | Success body is `{ success: true }` |
| `app/api/upload-media/route.ts`, `app/api/upload-mixcloud/route.ts`, `app/api/upload-drive/route.ts` | Success bodies match `SUCCESS_BODY` |

**Last confirmed at commit `006cccbdcb1a9abc044f013878355b59828044e9`.** To see what has changed since then, run:

```sh
git diff --stat 006cccbdcb1a9abc044f013878355b59828044e9 -- lib/upload-master-flow.ts lib/upload-fetch.ts app/upload-master/upload-master-form.tsx app/api/episodes app/api/upload-media/route.ts app/api/upload-mixcloud/route.ts app/api/upload-drive/route.ts
```

If that diff is not empty, reread the rows above against the new code. Move this commit forward only after the run passes and every row still describes the code.
