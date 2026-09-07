import { mock } from 'bun:test';

// Run from the repository root with bun. All CMS responses are mocked.
const calls: Record<string, unknown>[] = [];
mock.module(`${process.cwd()}/lib/cosmic-public.ts`, () => ({
  getPublicObjects: async (query: Record<string, unknown>) => { calls.push(query); return {objects:[], total:0}; },
  getPublicObject: async (query: Record<string, unknown>) => { calls.push(query); return {object:null}; },
}));
async function main() {
const { getCurrentScheduleShow } = await import(`${process.cwd()}/lib/schedule-service.ts`);
await getCurrentScheduleShow();
const first = calls.length;
await getCurrentScheduleShow();
console.log(JSON.stringify({fixture:'empty successful CMS responses, no linked episode lookups',firstPoll:first,secondPoll:calls.length-first,queries:calls.slice(0,first)},null,2));

}
void main();
