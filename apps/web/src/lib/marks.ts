import { NO_CATEGORY_COLOR, type EventOccurrence } from '@evo/shared';

/** One dot on the calendar: a category, or "Tanpa kategori" for events without one. */
export type DayMark = { key: string; name: string; color: string };

const NONE: DayMark = { key: 'none', name: 'Tanpa kategori', color: NO_CATEGORY_COLOR };

const markOf = (e: EventOccurrence): DayMark =>
  e.category_id ? { key: e.category_id, name: e.category_name ?? 'Kategori', color: e.category_color ?? NO_CATEGORY_COLOR } : NONE;

/** By name, with "Tanpa kategori" always last. */
export const compareMarks = (a: DayMark, b: DayMark): number =>
  a.key === 'none' ? (b.key === 'none' ? 0 : 1) : b.key === 'none' ? -1 : a.name.localeCompare(b.name, 'id');

/** Which categories have an event on each day, each category once. */
export function marksOf(events: EventOccurrence[]): Record<string, DayMark[]> {
  const seen: Record<string, Map<string, DayMark>> = {};
  for (const e of events) {
    const m = markOf(e);
    (seen[e.due_date] ??= new Map()).set(m.key, m);
  }
  return Object.fromEntries(Object.entries(seen).map(([d, map]) => [d, [...map.values()].sort(compareMarks)]));
}
