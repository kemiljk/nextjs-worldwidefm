/**
 * Cosmic episodes can carry the broadcast date in their title ("Luke Una – 06.10.2026")
 * so two shows from the same host are easy to tell apart in the Cosmic dashboard.
 * Listeners should never see it: the date already has its own place on every page.
 * These helpers strip it wherever episode data is read for the site.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// How a date can be separated from the rest of the title.
const SEPARATOR = String.raw`(?:\s*(?:[-–—|/·•:,]+|\/\/)\s*|\s+)`;
const DAY_FIRST = String.raw`(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})`;
const YEAR_FIRST = String.raw`(\d{4})[./-](\d{1,2})[./-](\d{1,2})`;
const WORDY = String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})`;
const ANY_DATE = `(?:${DAY_FIRST}|${YEAR_FIRST}|${WORDY})`;

const BRACKETED = new RegExp(String.raw`\s*[(\[]\s*${ANY_DATE}\s*[)\]]\s*$`);
const SEPARATED = new RegExp(`${SEPARATOR}${ANY_DATE}\\s*$`);

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function validDate({ year, month, day }: DateParts): DateParts | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 ? { year, month, day } : null;
}

/** Reads the date from a regex match of ANY_DATE (groups 1-9). */
function partsFromMatch(match: RegExpExecArray, offset: number): DateParts | null {
  const g = (index: number) => match[offset + index];
  if (g(1) !== undefined) {
    const year = Number(g(3));
    return validDate({
      year: g(3).length === 2 ? 2000 + year : year,
      month: Number(g(2)),
      day: Number(g(1)),
    });
  }
  if (g(4) !== undefined) {
    return validDate({ year: Number(g(4)), month: Number(g(5)), day: Number(g(6)) });
  }
  if (g(7) !== undefined) {
    const month = MONTHS.indexOf(g(8).slice(0, 3).toLowerCase()) + 1;
    return month ? validDate({ year: Number(g(9)), month, day: Number(g(7)) }) : null;
  }
  return null;
}

function parseBroadcastDate(value: string | null | undefined): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? validDate({ year: +match[1], month: +match[2], day: +match[3] }) : null;
}

/**
 * Removes a trailing date from an episode title.
 *
 * With the episode's broadcast date it is strict: only a date that matches it is removed, so a
 * title that genuinely ends in some other date is left alone. Without one, only a clearly
 * delimited date (after a dash, slash, bar or comma, or in brackets) is removed. A title is
 * never reduced to nothing.
 */
export function stripTitleDate(title: string, broadcastDate?: string | null): string {
  if (typeof title !== 'string') return title;
  const expected = parseBroadcastDate(broadcastDate);

  for (const pattern of [BRACKETED, SEPARATED]) {
    const match = pattern.exec(title);
    if (!match) continue;

    const found = partsFromMatch(match, 0);
    if (!found) continue;

    const separator = pattern === SEPARATED ? match[0].slice(0, match[0].search(/\d/)) : '(';
    const delimited = pattern === BRACKETED || /[^\s]/.test(separator);
    const matches = expected
      ? found.year === expected.year && found.month === expected.month && found.day === expected.day
      : delimited;
    if (!matches) continue;

    const stripped = title.slice(0, match.index).trimEnd();
    return stripped || title;
  }
  return title;
}

type Json = unknown;

/**
 * Strips the date from every episode title in a Cosmic response, in place. Episodes are found by
 * their `type`, plus any objects returned for a query that asked for episodes (queries can leave
 * `type` out of the returned props).
 */
export function stripEpisodeTitleDates<T extends Json>(result: T, queryType?: unknown): T {
  const clean = (object: Record<string, unknown>) => {
    if (typeof object.title !== 'string') return;
    const metadata = object.metadata as { broadcast_date?: string } | null | undefined;
    object.title = stripTitleDate(object.title, metadata?.broadcast_date);
  };

  const walk = (value: Json, assumeEpisode: boolean) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, assumeEpisode);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (object.type === 'episode' || assumeEpisode) clean(object);
    for (const [key, child] of Object.entries(object)) {
      if (child && typeof child === 'object' && key !== 'metadata_json') walk(child, false);
    }
  };

  if (result && typeof result === 'object') {
    const top = result as Record<string, unknown>;
    const asEpisodes = queryType === 'episode';
    walk(top.objects, asEpisodes);
    walk(top.object, asEpisodes);
    walk(result, false);
  }
  return result;
}

/**
 * "Luke Una" + 2026-10-06 → "Luke Una – 06.10.2026". Returns the title unchanged when it already
 * ends in its broadcast date, or when there is no valid broadcast date to add.
 */
export function appendTitleDate(title: string, broadcastDate?: string | null): string {
  const expected = parseBroadcastDate(broadcastDate);
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!expected || !trimmed) return title;
  if (stripTitleDate(trimmed, broadcastDate) !== trimmed) return trimmed;

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${trimmed} – ${pad(expected.day)}.${pad(expected.month)}.${expected.year}`;
}
