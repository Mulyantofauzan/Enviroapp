import { describe, it, expect } from 'vitest';
import { rainByDate, waterByDate, coagUsageDaily, tawasByDate, fillDates } from './reportSeries';
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
