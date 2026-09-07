'use cache: remote';

import { cacheLife, cacheTag } from 'next/cache';
import { getEvents, type RadioCultEventsParams } from './radiocult-service';

export async function getLiveScheduleEvents(params: RadioCultEventsParams) {
  cacheLife({ stale: 5, revalidate: 15, expire: 120 });
  cacheTag('radiocult', 'schedule');
  return getEvents(params, true);
}
