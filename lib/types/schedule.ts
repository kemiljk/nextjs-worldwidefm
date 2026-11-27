import type { UkWeekday } from '@/lib/date-utils';

export interface ScheduleShow {
  show_key: string;
  event_id: string;
  show_time: string;
  show_day: UkWeekday;
  date: string;
  name: string;
  url: string;
  picture: string;
  created_time: string;
  modified_time?: string;
  tags: string[];
  hosts: string[];
  duration: number;
  isManual?: boolean;
  isReplay?: boolean;
  /** Plain-text stand-in with no episode yet; replaced once the show is published. */
  isPlaceholder?: boolean;
}

export type ScheduleDayMap = Record<UkWeekday, string>;
