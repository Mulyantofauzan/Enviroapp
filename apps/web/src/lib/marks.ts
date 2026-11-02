import type { EventOccurrence } from '@evo/shared';

/** Red = overdue, yellow = still waiting (today or later), green = finished. */
export type DayStatus = 'overdue' | 'pending' | 'done';
export const DAY_STATUS_ORDER: DayStatus[] = ['overdue', 'pending', 'done'];
export const DAY_STATUS_WORDS: Record<DayStatus, string> = { overdue: 'ada overdue', pending: 'menunggu', done: 'selesai' };

const kind = (s: EventOccurrence['status']): DayStatus => (s === 'overdue' ? 'overdue' : s === 'done' ? 'done' : 'pending');

/** Which kinds of event fall on each day, each kind once, in the order red, yellow, green. */
export function marksOf(events: EventOccurrence[]): Record<string, DayStatus[]> {
  const seen: Record<string, Set<DayStatus>> = {};
  for (const e of events) (seen[e.due_date] ??= new Set()).add(kind(e.status));
  return Object.fromEntries(Object.entries(seen).map(([d, set]) => [d, DAY_STATUS_ORDER.filter((k) => set.has(k))]));
}
