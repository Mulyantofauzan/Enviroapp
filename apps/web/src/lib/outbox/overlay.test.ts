import { describe, it, expect } from 'vitest';
import type { DayData } from '../../hooks/useDay';
import type { OutboxItem } from './db';
import { applyPending } from './overlay';

const server: DayData = {
  weather: { rainfall_mm: 1, rain_hours: 1 },
  water: null,
  coagulant: { 'Tawas Serbuk': null, 'Tawas Batu': null, Kapur: { stock_in: 0, stock_out: 1, stock_remaining: 9 } },
  previousRemaining: { 'Tawas Serbuk': 50, 'Tawas Batu': null, Kapur: 10 },
};
let n = 0;
const item = (key: string, body: Record<string, unknown>, status: 'pending' | 'failed' = 'pending'): OutboxItem => ({
  id: `i${n++}`, owner: 'u1', kind: 'weather', key, group: null, label: key, request: { method: 'PUT', path: '/x', body },
  blob: null, recordedAt: '2026-11-02T08:00:00.000Z', seq: n, status, error: null, tries: 0, nextAt: 0,
});

describe('applyPending', () => {
  it('queued weather and water replace what the server returned', () => {
    const out = applyPending(server, [
      item('weather|2026-11-02', { rainfall_mm: 12.5, rain_hours: 3 }),
      item('water|2026-11-02|p1', { ph_inlet: 7, ph_outlet: 7.2, tss_inlet: null, tss_outlet: 20, debit_inlet_m3s: 0.01, debit_outlet_m3s: 0.02 }),
    ], '2026-11-02', 'p1');
    expect(out.weather).toEqual({ rainfall_mm: 12.5, rain_hours: 3 });
    expect(out.water).toMatchObject({ ph_inlet: 7, ph_outlet: 7.2, tss_outlet: 20 });
  });

  it('queued coagulant gets a computed remaining from the previous day when none was typed', () => {
    const out = applyPending(server, [item('coagulant|2026-11-02|p1|Tawas Serbuk', { stock_in: 10, stock_out: 4 })], '2026-11-02', 'p1');
    expect(out.coagulant['Tawas Serbuk']).toEqual({ stock_in: 10, stock_out: 4, stock_remaining: 56 });
  });

  it('a typed remaining wins over the calculation', () => {
    const out = applyPending(server, [item('coagulant|2026-11-02|p1|Kapur', { stock_in: 0, stock_out: 1, stock_remaining: 3 })], '2026-11-02', 'p1');
    expect(out.coagulant.Kapur?.stock_remaining).toBe(3);
  });

  it('ignores other dates, other ponds and failed items', () => {
    const out = applyPending(server, [
      item('weather|2026-11-03', { rainfall_mm: 99, rain_hours: 9 }),
      item('water|2026-11-02|p2', { ph_inlet: 1 }),
      item('weather|2026-11-02', { rainfall_mm: 77, rain_hours: 7 }, 'failed'),
    ], '2026-11-02', 'p1');
    expect(out).toEqual(server);
  });

  it('does not change its input', () => {
    const copy = JSON.parse(JSON.stringify(server));
    applyPending(server, [item('weather|2026-11-02', { rainfall_mm: 5, rain_hours: 1 })], '2026-11-02', 'p1');
    expect(server).toEqual(copy);
  });
});
