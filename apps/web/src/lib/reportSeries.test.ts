import { describe, it, expect } from 'vitest';
import { rainByDate, waterByDate, coagUsageDaily, tawasByDate, fillDates, coagUsageBuckets } from './reportSeries';
import type { HistoryEntry } from './report';

const co = (type: string, out: number | null) => ({ type, stock_in: null, stock_out: out, stock_remaining: null, staleRemaining: false });
const e = (date: string, sp: string | null, o: Partial<HistoryEntry> = {}): HistoryEntry => ({ date, sp_id: sp, weather: null, water: null, coagulant: [], ...o });
const water = (o = {}) => ({ ph_inlet: 7, ph_outlet: 7.2, tss_inlet: 100, tss_outlet: 30, debit_inlet_m3d: 1000, debit_outlet_m3d: 900, ...o });

describe('series', () => {
  it('fillDates lists every day inclusive', () => {
    expect(fillDates('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('rainByDate: ascending, one value per date even if several ponds repeat it', () => {
    const w = { rainfall_mm: 4, rain_hours: 1 };
    expect(rainByDate([e('2026-11-02', 'a', { weather: w }), e('2026-11-02', 'b', { weather: w }), e('2026-11-01', 'a', { weather: { rainfall_mm: null, rain_hours: null } })]))
      .toEqual([{ date: '2026-11-01', value: null }, { date: '2026-11-02', value: 4 }]);
  });
  it('waterByDate: only the asked pond, every date present, gaps are null', () => {
    const out = waterByDate([e('2026-11-02', 'a', { water: water() }), e('2026-11-02', 'b', { water: water({ ph_outlet: 1 }) })], 'a', '2026-11-01', '2026-11-02');
    expect(out.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(out[0].ph_outlet).toBeNull();
    expect(out[1]).toMatchObject({ ph_outlet: 7.2, tss_outlet: 30, debit_outlet_m3d: 900 });
  });
  it('coagUsageDaily: sums Out across ponds per type; empty day stays null; empty Out on a recorded day is 0', () => {
    const out = coagUsageDaily([
      e('2026-11-02', 'a', { coagulant: [co('Kapur', 5), co('Tawas Serbuk', null)] }),
      e('2026-11-02', 'b', { coagulant: [co('Kapur', 3)] }),
    ], '2026-11-01', '2026-11-02');
    expect(out[0]).toEqual({ date: '2026-11-01', Kapur: null, 'Tawas Serbuk': null, 'Tawas Batu': null });
    expect(out[1]).toEqual({ date: '2026-11-02', Kapur: 8, 'Tawas Serbuk': 0, 'Tawas Batu': null });
  });
  it('tawasByDate: Serbuk plus Batu, never Kapur', () => {
    const out = tawasByDate([e('2026-11-02', 'a', { coagulant: [co('Kapur', 50), co('Tawas Serbuk', 4), co('Tawas Batu', 6)] }), e('2026-11-01', 'a', { coagulant: [co('Kapur', 9)] })]);
    expect(out).toEqual([{ date: '2026-11-01', value: null }, { date: '2026-11-02', value: 10 }]);
  });
});

describe('coagUsageBuckets: the chart stays readable for any period', () => {
  const rows = (dates: string[], serbuk = 5) => dates.map((d) => e(d, 'a', { coagulant: [co('Kapur', 1), co('Tawas Serbuk', serbuk), co('Tawas Batu', 2)] }));
  it('up to 31 days: one group per day, day numbers when inside one month', () => {
    const b = coagUsageBuckets(rows(['2026-10-05']), '2026-10-01', '2026-10-07');
    expect(b.unit).toBe('hari');
    expect(b.categories.map((c) => c.label)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(b.series.map((x) => x.name)).toEqual(['Kapur', 'Tawas Serbuk', 'Tawas Batu']);
    expect(b.series[1].values[4]).toBe(5);
    expect(b.series[1].values[0]).toBeNull();
  });
  it('a daily range that crosses a month shows day and month on the axis', () => {
    const b = coagUsageBuckets([], '2026-10-30', '2026-11-02');
    expect(b.categories.map((c) => c.label)).toEqual(['30 Okt', '31 Okt', '1 Nov', '2 Nov']);
  });
  it('32 to 180 days: weekly sums keyed by Monday, only days inside the period count', () => {
    const b = coagUsageBuckets(rows(['2026-10-05', '2026-10-06', '2026-10-12']), '2026-10-01', '2026-11-15');
    expect(b.unit).toBe('minggu');
    expect(b.categories[0].key).toBe('2026-09-28');
    const wk1 = b.categories.findIndex((c) => c.key === '2026-10-05');
    expect(b.series[1].values[wk1]).toBe(10);
    expect(b.series[1].values[wk1 + 1]).toBe(5);
    expect(b.series[1].values[0]).toBeNull();
    expect(b.categories.at(-1)!.key).toBe('2026-11-09');
  });
  it('over 180 days: monthly sums with month labels', () => {
    const b = coagUsageBuckets(rows(['2026-01-10', '2026-01-20', '2026-06-01']), '2026-01-01', '2026-08-31');
    expect(b.unit).toBe('bulan');
    expect(b.categories).toHaveLength(8);
    expect(b.categories[0].label).toBe('Jan 26');
    expect(b.series[1].values[0]).toBe(10);
    expect(b.series[1].values[5]).toBe(5);
    expect(b.series[1].values[1]).toBeNull();
  });
  it('a 366-day period yields at most 13 groups', () => {
    expect(coagUsageBuckets([], '2025-11-02', '2026-11-02').categories.length).toBeLessThanOrEqual(13);
  });
});
