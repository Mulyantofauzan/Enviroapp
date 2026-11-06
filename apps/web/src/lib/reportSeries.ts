import type { DayValue } from './aggregate';
import { monthLabel } from './aggregate';
import { addDays, addMonths, dayMonth, mondayOf, monthRange } from './dates';
import { periodDays } from './windows';
import { entryNoFlow, type HistoryEntry } from './report';

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

export type WaterDay = { date: string; ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_outlet_ls: number | null; noFlow: boolean };

export function waterByDate(entries: HistoryEntry[], spId: string, from: string, to: string): WaterDay[] {
  const byDate = new Map(entries.filter((e) => e.sp_id === spId && e.water).map((e) => [e.date, e.water!]));
  return fillDates(from, to).map((date) => {
    const w = byDate.get(date);
    return { date, ph_inlet: w?.ph_inlet ?? null, ph_outlet: w?.ph_outlet ?? null, tss_inlet: w?.tss_inlet ?? null, tss_outlet: w?.tss_outlet ?? null, debit_outlet_ls: w?.debit_outlet_ls ?? null, noFlow: w ? entryNoFlow(w) : false };
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

export type CoagBuckets = {
  unit: 'hari' | 'minggu' | 'bulan';
  categories: { key: string; label: string }[];
  series: { name: string; values: (number | null)[] }[];
};

const DAILY_MAX = 31;
const WEEKLY_MAX = 180;

/**
 * Used amount (Out, kg) per type for the chosen period, grouped so the chart never gets too dense:
 * a group per day up to 31 days, per week up to 180 days, per month beyond that.
 */
export function coagUsageBuckets(entries: HistoryEntry[], from: string, to: string): CoagBuckets {
  const days = periodDays(from, to);
  const perType = new Map<string, Map<string, number>>(COAG_TYPES.map((t) => [t, new Map()]));
  for (const e of entries) for (const c of e.coagulant) {
    const m = perType.get(c.type);
    if (m) m.set(e.date, (m.get(e.date) ?? 0) + (c.stock_out ?? 0));
  }
  const sumOver = (type: string, a: string, b: string): number | null => {
    const m = perType.get(type)!;
    let total: number | null = null;
    for (let d = a; d <= b; d = addDays(d, 1)) if (m.has(d)) total = (total ?? 0) + m.get(d)!;
    return total;
  };

  let ranges: { key: string; label: string; a: string; b: string }[];
  let unit: CoagBuckets['unit'];
  if (days <= DAILY_MAX) {
    unit = 'hari';
    const crosses = from.slice(0, 7) !== to.slice(0, 7);
    ranges = fillDates(from, to).map((d) => ({ key: d, label: crosses ? dayMonth(d) : String(Number(d.slice(8))), a: d, b: d }));
  } else if (days <= WEEKLY_MAX) {
    unit = 'minggu';
    ranges = [];
    for (let m = mondayOf(from); m <= to; m = addDays(m, 7)) ranges.push({ key: m, label: dayMonth(m), a: m < from ? from : m, b: addDays(m, 6) > to ? to : addDays(m, 6) });
  } else {
    unit = 'bulan';
    ranges = [];
    for (let month = from.slice(0, 7); month <= to.slice(0, 7); month = addMonths(month, 1)) {
      const [first, last] = monthRange(month);
      ranges.push({ key: month, label: monthLabel(month), a: first < from ? from : first, b: last > to ? to : last });
    }
  }
  return {
    unit,
    categories: ranges.map((r) => ({ key: r.key, label: r.label })),
    series: COAG_TYPES.map((t) => ({ name: t, values: ranges.map((r) => sumOver(t, r.a, r.b)) })),
  };
}
