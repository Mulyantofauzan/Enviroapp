import { addDays } from './dates';

const DAY = 86_400_000;
export const MAX_PERIOD_DAYS = 366;
export const EVENT_WINDOW_DAYS = 62;

/** Days from `from` to `to`, both ends counted. */
export const periodDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;

export function validatePeriod(from: string, to: string): string | null {
  if (from > to) return 'Tanggal awal harus sebelum tanggal akhir.';
  if (periodDays(from, to) > MAX_PERIOD_DAYS) return `Pilih rentang ${MAX_PERIOD_DAYS} hari atau kurang.`;
  return null;
}

/** Back-to-back windows of at most `max` days: the events API refuses anything longer. */
export function eventWindows(from: string, to: string, max = EVENT_WINDOW_DAYS): [string, string][] {
  const out: [string, string][] = [];
  for (let start = from; start <= to; ) {
    const end = addDays(start, max - 1);
    const stop = end < to ? end : to;
    out.push([start, stop]);
    start = addDays(stop, 1);
  }
  return out;
}
