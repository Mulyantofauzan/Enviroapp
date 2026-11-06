import { describe, it, expect } from 'vitest';
import type { HistoryEntry } from '../report';
import type { Pond } from '../../pond/PondContext';
import { pondPage, pondTitle, weatherPage } from './pages';

const TO = '2026-10-25'; // Sunday, ISO W43

const wx = (date: string, rain: number | null, hours: number | null, sp: string | null = null): HistoryEntry => ({
  date, sp_id: sp, weather: { rainfall_mm: rain, rain_hours: hours }, water: null, coagulant: [],
});
const water = (date: string, sp: string, w: Partial<NonNullable<HistoryEntry['water']>>): HistoryEntry => ({
  date, sp_id: sp, weather: null,
  water: { ph_inlet: null, ph_outlet: null, tss_inlet: null, tss_outlet: null, debit_inlet_m3d: null, debit_outlet_m3d: null, ...w },
  coagulant: [],
});
const coag = (date: string, sp: string, rows: [string, number | null][]): HistoryEntry => ({
  date, sp_id: sp, weather: null, water: null,
  coagulant: rows.map(([type, out]) => ({ type, stock_in: 0, stock_out: out, stock_remaining: 0, staleRemaining: false })),
});

describe('weatherPage', () => {
  it('builds 7 rows with intensity, zero when no hours', () => {
    const p = weatherPage([wx('2026-10-24', 20, 4), wx('2026-10-25', 5, 0)], TO);
    expect(p.title).toBe('WEATHER MONITORING');
    expect(p.rows).toHaveLength(7);
    expect(p.rows[0]).toEqual({ date: '2026-10-19', rain: 0, hours: 0, intensity: 0 });
    expect(p.rows[5]).toEqual({ date: '2026-10-24', rain: 20, hours: 4, intensity: 5 });
    expect(p.rows[6].intensity).toBe(0);
  });

  it('summarises rainy days, totals and the highest daily intensity', () => {
    const p = weatherPage([wx('2026-10-23', 12, 2), wx('2026-10-24', 30, 10), wx('2026-10-25', 0, 0)], TO);
    expect(p.summary).toEqual({ rainyDays: 2, rainMm: 42, hours: 12, maxIntensity: 6 });
  });

  it('leaves a gap in the 1W chart for days without a record', () => {
    const p = weatherPage([wx('2026-10-25', 5, 1)], TO);
    expect(p.w1.a.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(p.w1.a[6]).toBe(5);
    expect(p.w1.b[6]).toBe(1);
    expect(p.w1.categories[0]).toBe('19-Oct');
  });

  it('uses weekly and monthly TOTALS, not averages', () => {
    const p = weatherPage([wx('2026-10-19', 10, 1), wx('2026-10-20', 20, 3), wx('2026-09-30', 7, 2)], TO);
    expect(p.w5.categories).toEqual(['W39', 'W40', 'W41', 'W42', 'W43']);
    expect(p.w5.a[4]).toBe(30);
    expect(p.w5.b[4]).toBe(4);
    expect(p.w5.a[3]).toBeNull();
    expect(p.m12.categories).toHaveLength(12);
    expect(p.m12.categories[11]).toBe('Oct');
    expect(p.m12.a[11]).toBe(30);
    expect(p.m12.a[10]).toBe(7);
  });

  it('ignores days after `to` and counts a date repeated per pond once', () => {
    const p = weatherPage([wx('2026-10-25', 5, 1, 'a'), wx('2026-10-25', 5, 1, 'b'), wx('2026-10-26', 99, 9)], TO);
    expect(p.summary.rainMm).toBe(5);
    expect(p.m12.a[11]).toBe(5);
  });

  it('has no NaN with no data at all', () => {
    const p = weatherPage([], TO);
    expect(p.summary).toEqual({ rainyDays: 0, rainMm: 0, hours: 0, maxIntensity: 0 });
    expect(JSON.stringify(p)).not.toContain('NaN');
  });
});

const pond = (over: Partial<Pond> = {}): Pond => ({ id: 'p1', code: 'SP 11', name: 'LGG', is_active: true, ...over });

describe('pondTitle', () => {
  it('uppercases code and name', () => {
    expect(pondTitle({ code: 'SP 11', name: 'LGG' })).toBe('SP 11 LGG MONITORING');
    expect(pondTitle({ code: null, name: 'Lgg' })).toBe('LGG MONITORING');
  });
});

describe('pondPage', () => {
  it('reads water series, limits, and converts debit to L/s', () => {
    const p = pondPage(
      [water('2026-10-25', 'p1', { ph_inlet: 6.5, ph_outlet: 7.2, tss_inlet: 120, tss_outlet: 40, debit_inlet_m3d: 864, debit_outlet_m3d: 1296 }), water('2026-10-25', 'p2', { ph_outlet: 1 })],
      pond({ thresholds: { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 100 } } }), TO, null,
    );
    expect(p.title).toBe('SP 11 LGG MONITORING');
    expect(p.days).toHaveLength(7);
    expect(p.ph).toEqual({ inlet: [null, null, null, null, null, null, 6.5], outlet: [null, null, null, null, null, null, 7.2], min: 6, max: 9 });
    expect(p.tss.limit).toBe(100);
    expect(p.tss.outlet[6]).toBe(40);
    expect(p.debit.inlet[6]).toBe(10);
    expect(p.debit.outlet[6]).toBe(15);
  });

  it('a no-flow day plots zero for the outlet series and is counted', () => {
    const p = pondPage(
      [water('2026-10-25', 'p1', { ph_inlet: 6.5, ph_outlet: null, tss_inlet: 120, tss_outlet: null, debit_inlet_m3d: 864, debit_outlet_m3d: 0 })],
      pond({ thresholds: { ph_outlet: { min: 6, max: 9 } } }), TO, null,
    );
    expect(p.ph.outlet[6]).toBe(0);
    expect(p.tss.outlet[6]).toBe(0);
    expect(p.debit.outlet[6]).toBe(0);
    expect(p.ph.inlet[6]).toBe(6.5);
    expect(p.noFlowDays).toBe(1);
  });
  it('has null limits for a pond without thresholds', () => {
    const p = pondPage([], pond(), TO, null);
    expect(p.ph.min).toBeNull();
    expect(p.ph.max).toBeNull();
    expect(p.tss.limit).toBeNull();
  });

  it('shows tawas per day without Kapur', () => {
    const p = pondPage([coag('2026-10-25', 'p1', [['Tawas Batu', 40], ['Tawas Serbuk', 10], ['Kapur', 500]])], pond(), TO, null);
    expect(p.coag.batu[6]).toBe(40);
    expect(p.coag.serbuk[6]).toBe(10);
    expect(p.coag.batu[0]).toBeNull();
  });

  it('totals weekly tawas with bags and per-day average (running week uses elapsed days)', () => {
    const e = [coag('2026-10-12', 'p1', [['Tawas Batu', 100], ['Tawas Serbuk', 75]]), coag('2026-10-21', 'p1', [['Tawas Serbuk', 30]])];
    const full = pondPage(e, pond(), TO, null);
    expect(full.weekly.labels).toEqual(['W39', 'W40', 'W41', 'W42', 'W43']);
    expect(full.weekly.totalKg[3]).toBe(175);
    expect(full.weekly.bags[3]).toBe(7);
    expect(full.weekly.avgPerDay[3]).toBe(25);
    expect(full.weekly.chart[3]).toBe(175);
    const running = pondPage(e, pond(), '2026-10-21', null);
    expect(running.weekly.totalKg[4]).toBe(30);
    expect(running.weekly.avgPerDay[4]).toBe(10);
  });

  it('keeps 5 months, 12 chart months, and YTD from 1 January only', () => {
    const e = [coag('2025-12-31', 'p1', [['Tawas Batu', 1000]]), coag('2026-01-01', 'p1', [['Tawas Batu', 50]]), coag('2026-10-02', 'p1', [['Tawas Serbuk', 25]])];
    const p = pondPage(e, pond(), TO, { serbuk: 400, batu: 1600 });
    expect(p.monthly.labels).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
    expect(p.monthly.totalKg[4]).toBe(25);
    expect(p.monthly.bags[4]).toBe(1);
    expect(p.ytdChart.labels).toHaveLength(12);
    expect(p.ytd).toEqual({ kg: 75, bags: 3 });
    expect(p.project).toEqual({ kg: 2000, bags: 80 });
  });

  it('ignores other ponds and survives empty data without NaN', () => {
    const p = pondPage([coag('2026-10-25', 'p2', [['Tawas Batu', 999]])], pond(), TO, null);
    expect(p.ytd).toEqual({ kg: 0, bags: 0 });
    expect(p.project).toEqual({ kg: 0, bags: 0 });
    expect(p.weekly.avgPerDay.every((v) => v === 0)).toBe(true);
    expect(JSON.stringify(p)).not.toContain('NaN');
  });
});
