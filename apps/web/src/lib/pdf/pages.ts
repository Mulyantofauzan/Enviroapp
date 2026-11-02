import type { Pond } from '../../pond/PondContext';
import type { DayValue } from '../aggregate';
import { sumByMonth, sumByWeek } from '../aggregate';
import type { HistoryEntry } from '../report';
import { tawasByDate } from '../reportSeries';
import { bags, lastDays, lastMonths, lastWeeks, dayLabel } from './dates';

export type Pt = number | null;
export type Series = { categories: string[]; a: Pt[]; b: Pt[] };

export type WeatherPage = {
  title: 'WEATHER MONITORING';
  rows: { date: string; rain: number; hours: number; intensity: number }[];
  summary: { rainyDays: number; rainMm: number; hours: number; maxIntensity: number };
  w1: Series; w5: Series; m12: Series;
};

export type PondPage = {
  title: string;
  days: string[];
  ph: { inlet: Pt[]; outlet: Pt[]; min: number | null; max: number | null };
  tss: { inlet: Pt[]; outlet: Pt[]; limit: number | null };
  debit: { inlet: Pt[]; outlet: Pt[] };
  coag: { batu: Pt[]; serbuk: Pt[] };
  weekly: { labels: string[]; totalKg: number[]; bags: number[]; avgPerDay: number[]; chart: Pt[] };
  monthly: { labels: string[]; totalKg: number[]; bags: number[] };
  ytdChart: { labels: string[]; values: Pt[] };
  ytd: { kg: number; bags: number };
  project: { kg: number; bags: number };
};

/** 1 m3/day = 1000 L / 86400 s. */
const L_PER_S_DIVISOR = 86.4;
const MONTHLY_ROWS = 5;
const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

type Wx = { rain: number | null; hours: number | null };

/** Weather is site-wide and repeated per pond entry: keep the first record per date, never after `to`. */
function weatherByDate(entries: HistoryEntry[], to: string): Map<string, Wx> {
  const m = new Map<string, Wx>();
  for (const e of entries) {
    if (e.date > to || !e.weather || m.has(e.date)) continue;
    m.set(e.date, { rain: e.weather.rainfall_mm, hours: e.weather.rain_hours });
  }
  return m;
}

export function weatherPage(entries: HistoryEntry[], to: string): WeatherPage {
  const wx = weatherByDate(entries, to);
  const days = lastDays(to, 7);
  const rows = days.map((date) => {
    const w = wx.get(date);
    const rain = w?.rain ?? 0, hours = w?.hours ?? 0;
    return { date, rain, hours, intensity: hours > 0 ? rain / hours : 0 };
  });
  const rainDays: DayValue[] = [...wx].map(([date, w]) => ({ date, value: w.rain }));
  const hourDays: DayValue[] = [...wx].map(([date, w]) => ({ date, value: w.hours }));
  const weeks = lastWeeks(to, 5);
  const months = lastMonths(to, 12);
  return {
    title: 'WEATHER MONITORING',
    rows,
    summary: {
      rainyDays: rows.filter((r) => r.rain > 0).length,
      rainMm: sum(rows.map((r) => r.rain)),
      hours: sum(rows.map((r) => r.hours)),
      maxIntensity: Math.max(0, ...rows.map((r) => r.intensity)),
    },
    w1: { categories: days.map(dayLabel), a: days.map((d) => wx.get(d)?.rain ?? null), b: days.map((d) => wx.get(d)?.hours ?? null) },
    w5: { categories: weeks.map((w) => w.label), a: sumByWeek(rainDays, to, 5).map((b) => b.value), b: sumByWeek(hourDays, to, 5).map((b) => b.value) },
    m12: { categories: months.map((m) => m.label), a: sumByMonth(rainDays, to, 12).map((b) => b.value), b: sumByMonth(hourDays, to, 12).map((b) => b.value) },
  };
}

export const pondTitle = (p: Pick<Pond, 'code' | 'name'>) => `${(p.code ? `${p.code} ${p.name}` : p.name).toUpperCase()} MONITORING`;

export function pondPage(entries: HistoryEntry[], pond: Pond, to: string, total: { serbuk: number; batu: number } | null): PondPage {
  const mine = entries.filter((e) => e.sp_id === pond.id && e.date <= to);
  const days = lastDays(to, 7);
  const waterOn = new Map(mine.filter((e) => e.water).map((e) => [e.date, e.water!]));
  const pick = (f: (w: NonNullable<HistoryEntry['water']>) => Pt): Pt[] => days.map((d) => { const w = waterOn.get(d); return w ? f(w) : null; });
  const lps = (v: Pt): Pt => (v === null ? null : Math.round((v / L_PER_S_DIVISOR) * 1000) / 1000);

  const outOn = (type: string) => {
    const m = new Map<string, number>();
    for (const e of mine) for (const c of e.coagulant) if (c.type === type) m.set(e.date, (m.get(e.date) ?? 0) + (c.stock_out ?? 0));
    return days.map((d): Pt => m.get(d) ?? null);
  };

  const tawas = tawasByDate(mine);
  const weeks = lastWeeks(to, 5);
  const weekBuckets = sumByWeek(tawas, to, 5);
  const totalKg = weekBuckets.map((b) => b.value ?? 0);
  const monthBuckets = sumByMonth(tawas, to, 12);
  const monthsAll = lastMonths(to, 12);
  const lastM = monthBuckets.slice(-MONTHLY_ROWS).map((b) => b.value ?? 0);
  const ytdKg = sum(tawas.filter((d) => d.date >= `${to.slice(0, 4)}-01-01` && d.value !== null).map((d) => d.value as number));
  const projectKg = total ? total.serbuk + total.batu : 0;

  return {
    title: pondTitle(pond),
    days,
    ph: { inlet: pick((w) => w.ph_inlet), outlet: pick((w) => w.ph_outlet), min: pond.thresholds?.ph_outlet?.min ?? null, max: pond.thresholds?.ph_outlet?.max ?? null },
    tss: { inlet: pick((w) => w.tss_inlet), outlet: pick((w) => w.tss_outlet), limit: pond.thresholds?.tss_outlet?.max ?? null },
    debit: { inlet: pick((w) => lps(w.debit_inlet_m3d)), outlet: pick((w) => lps(w.debit_outlet_m3d)) },
    coag: { batu: outOn('Tawas Batu'), serbuk: outOn('Tawas Serbuk') },
    weekly: {
      labels: weeks.map((w) => w.label),
      totalKg,
      bags: totalKg.map(bags),
      avgPerDay: totalKg.map((kg, i) => round1(kg / weeks[i].days)),
      chart: weekBuckets.map((b) => b.value),
    },
    monthly: { labels: monthsAll.slice(-MONTHLY_ROWS).map((m) => m.label), totalKg: lastM, bags: lastM.map(bags) },
    ytdChart: { labels: monthsAll.map((m) => m.label), values: monthBuckets.map((b) => b.value) },
    ytd: { kg: ytdKg, bags: bags(ytdKg) },
    project: { kg: projectKg, bags: bags(projectKg) },
  };
}
