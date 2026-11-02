import { describe, it, expect } from 'vitest';
import type { EventOccurrence } from '@evo/shared';
import { buildReport, cellText, reportRowCount, type HistoryEntry } from './report';
import type { Pond } from '../pond/PondContext';

const POND_A: Pond = { id: 'a', code: 'SP-02', name: 'Pit Selatan', is_active: true, thresholds: { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 40 } } };
const POND_B: Pond = { id: 'b', code: 'SP-01', name: 'Pit Utara', is_active: true, thresholds: {} };
const water = (o: Partial<NonNullable<HistoryEntry['water']>> = {}) => ({ ph_inlet: 7, ph_outlet: 7, tss_inlet: 100, tss_outlet: 30, debit_inlet_m3d: 1000, debit_outlet_m3d: 1278.7, ...o });
const entry = (date: string, sp: string | null, o: Partial<HistoryEntry> = {}): HistoryEntry => ({ date, sp_id: sp, weather: null, water: null, coagulant: [], ...o });
const ev = (o: Partial<EventOccurrence> = {}): EventOccurrence => ({
  schedule_id: 's1', title: 'Cek pompa', description: null, frequency: 'Daily', sp_id: null, assigned_to_name: null,
  due_date: '2026-11-02', status: 'upcoming', late: false, evidence_count: 0, completed_at: null, completed_by_name: null, ...o,
});
const air = (e: HistoryEntry[]) => buildReport({ entries: e, events: [], ponds: [POND_A, POND_B], kinds: ['air'] })[0];

describe('buildReport: air', () => {
  it('newest first, empty cells are null, title and columns as specified', () => {
    const s = air([entry('2026-11-01', 'a', { water: water({ ph_inlet: null }) }), entry('2026-11-02', 'a', { water: water() })]);
    expect(s.title).toBe('Air Permukaan');
    expect(s.columns.map((c) => c.key)).toEqual(['date', 'pond', 'phi', 'pho', 'tssi', 'tsso', 'di', 'do']);
    expect(s.rows.map((r) => r.cells.date)).toEqual(['2 Nov 2026', '1 Nov 2026']);
    expect(s.rows[1].cells.phi).toBeNull();
    expect(s.rows[0].cells.pond).toBe('SP-02');
  });
  it('flags only outlet values outside the pond limit', () => {
    const s = air([entry('2026-11-02', 'a', { water: water({ ph_outlet: 5.8, tss_outlet: 55, ph_inlet: 2, tss_inlet: 999 }) })]);
    expect(s.rows[0].bad.sort()).toEqual(['pho', 'tsso']);
  });
  it('a pond without limits, or an unknown pond, flags nothing', () => {
    const s = air([entry('2026-11-02', 'b', { water: water({ ph_outlet: 1 }) }), entry('2026-11-01', 'zzz', { water: water({ ph_outlet: 1 }) })]);
    expect(s.rows.every((r) => r.bad.length === 0)).toBe(true);
  });
  it('skips entries without water data', () => {
    expect(air([entry('2026-11-02', 'a')]).rows).toHaveLength(0);
  });
});

describe('buildReport: cuaca and koagulan', () => {
  it('one weather row per date even when several ponds repeat it', () => {
    const w = { rainfall_mm: 12.5, rain_hours: 3 };
    const s = buildReport({ entries: [entry('2026-11-02', 'a', { weather: w }), entry('2026-11-02', 'b', { weather: w })], events: [], ponds: [POND_A, POND_B], kinds: ['cuaca'] })[0];
    expect(s.title).toBe('Cuaca');
    expect(s.rows).toHaveLength(1);
    expect(s.columns.map((c) => c.key)).toEqual(['date', 'rain', 'hours']);
  });
  it('coagulant rows carry the stock mismatch note', () => {
    const c = (stale: boolean) => ({ type: 'Kapur', stock_in: 10, stock_out: 2, stock_remaining: 8, staleRemaining: stale });
    const s = buildReport({ entries: [entry('2026-11-02', 'a', { coagulant: [c(true)] }), entry('2026-11-01', 'a', { coagulant: [c(false)] })], events: [], ponds: [POND_A], kinds: ['koagulan'] })[0];
    expect(s.title).toBe('Koagulan');
    expect(s.columns.map((x) => x.key)).toEqual(['date', 'pond', 'type', 'in', 'out', 'left', 'note']);
    expect(s.rows[0].cells.note).toBe('Selisih stok');
    expect(s.rows[1].cells.note).toBeNull();
  });
});

describe('buildReport: event', () => {
  const run = (events: EventOccurrence[]) => buildReport({ entries: [], events, ponds: [POND_A], kinds: ['event'] })[0];
  it('status labels, place, completion time in WITA and newest first', () => {
    const s = run([
      ev({ due_date: '2026-11-01', status: 'done', late: true, completed_by_name: 'Rudi', completed_at: '2026-11-02T00:21:00.000Z', evidence_count: 2, sp_id: 'a' }),
      ev({ due_date: '2026-11-02', status: 'today' }),
      ev({ due_date: '2026-10-30', status: 'done' }), ev({ due_date: '2026-10-29', status: 'overdue' }), ev({ due_date: '2026-11-05', status: 'upcoming' }),
    ]);
    expect(s.title).toBe('Event');
    expect(s.rows.map((r) => r.cells.status)).toEqual(['Mendatang', 'Hari ini', 'Selesai (terlambat)', 'Selesai', 'Overdue']);
    const late = s.rows[2];
    expect(late.cells.place).toBe('SP-02 Pit Selatan');
    expect(late.cells.at).toBe('2 Nov 2026 08:21');
    expect(late.cells.by).toBe('Rudi');
    expect(late.cells.evidence).toBe(2);
    expect(s.rows[1].cells.place).toBe('Semua lokasi');
    expect(s.rows[1].cells.at).toBeNull();
    expect(s.rows[1].cells.freq).toBe('Harian');
  });
});

describe('selection and helpers', () => {
  it('only the chosen kinds, in a fixed order', () => {
    const r = buildReport({ entries: [], events: [], ponds: [], kinds: ['event', 'cuaca'] });
    expect(r.map((s) => s.id)).toEqual(['cuaca', 'event']);
  });
  it('cellText: dash for empty, id-ID numbers with the column decimals, text untouched', () => {
    expect(cellText({ key: 'x', header: 'x', kind: 'number', decimals: 1 }, 1278.7)).toBe('1.278,7');
    expect(cellText({ key: 'x', header: 'x', kind: 'number' }, null)).toBe('–');
    expect(cellText({ key: 'x', header: 'x', kind: 'text' }, '')).toBe('–');
    expect(cellText({ key: 'x', header: 'x', kind: 'text' }, 'SP-02')).toBe('SP-02');
  });
  it('reportRowCount adds up all sections', () => {
    const r = buildReport({ entries: [entry('2026-11-02', 'a', { water: water(), weather: { rainfall_mm: 1, rain_hours: 1 } })], events: [ev()], ponds: [POND_A], kinds: ['cuaca', 'air', 'event'] });
    expect(reportRowCount(r)).toBe(3);
  });
});
