import type { DayValue } from './aggregate';
import { addDays } from './dates';
import type { HistoryEntry } from './report';

/** Every date from `from` to `to`, inclusive. */
export function fillDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Rainfall is site-wide: entries repeat it once per pond, so keep one value per date. */
export function rainByDate(entries: HistoryEntry[]): DayValue[] {
  const m = new Map<string, number | null>();
  for (const e of entries) if (e.weather && !m.has(e.date)) m.set(e.date, e.weather.rainfall_mm);
  return [...m.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type WaterDay = { date: string; ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_outlet_m3d: number | null };

export function waterByDate(entries: HistoryEntry[], spId: string, from: string, to: string): WaterDay[] {
  const byDate = new Map(entries.filter((e) => e.sp_id === spId && e.water).map((e) => [e.date, e.water!]));
  return fillDates(from, to).map((date) => {
    const w = byDate.get(date);
    return { date, ph_inlet: w?.ph_inlet ?? null, ph_outlet: w?.ph_outlet ?? null, tss_inlet: w?.tss_inlet ?? null, tss_outlet: w?.tss_outlet ?? null, debit_outlet_m3d: w?.debit_outlet_m3d ?? null };
  });
}

export const COAG_TYPES = ['Kapur', 'Tawas Serbuk', 'Tawas Batu'] as const;
export type CoagDay = { date: string } & Record<(typeof COAG_TYPES)[number], number | null>;

/** Used amount (Out, kg) per day and type, added up across ponds. A day with no row for a type stays empty. */
export function coagUsageDaily(entries: HistoryEntry[], from: string, to: string): CoagDay[] {
  const sums = new Map<string, number>();
  for (const e of entries) for (const c of e.coagulant) {
    const k = `${e.date}|${c.type}`;
    sums.set(k, (sums.get(k) ?? 0) + (c.stock_out ?? 0));
  }
  return fillDates(from, to).map((date) => ({
    date,
    Kapur: sums.get(`${date}|Kapur`) ?? null,
    'Tawas Serbuk': sums.get(`${date}|Tawas Serbuk`) ?? null,
    'Tawas Batu': sums.get(`${date}|Tawas Batu`) ?? null,
  }));
}

/** Tawas = Serbuk + Batu (kg per day). Kapur is not tawas. */
export function tawasByDate(entries: HistoryEntry[]): DayValue[] {
  const sums = new Map<string, number>();
  for (const e of entries) for (const c of e.coagulant) {
    if (c.type !== 'Tawas Serbuk' && c.type !== 'Tawas Batu') continue;
    sums.set(e.date, (sums.get(e.date) ?? 0) + (c.stock_out ?? 0));
  }
  const dates = new Set(entries.map((e) => e.date));
  return [...dates].sort().map((date) => ({ date, value: sums.get(date) ?? null }));
}
