import type { EventOccurrence } from '@evo/shared';

export type Mark = 'overdue' | 'scheduled';

/** One mark per day: red wins over blue. */
export function marksOf(events: EventOccurrence[]): Record<string, Mark> {
  const m: Record<string, Mark> = {};
  for (const e of events) {
    if (e.status === 'overdue') m[e.due_date] = 'overdue';
    else if (!m[e.due_date]) m[e.due_date] = 'scheduled';
  }
  return m;
}
