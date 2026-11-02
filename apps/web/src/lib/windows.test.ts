import { describe, it, expect } from 'vitest';
import { eventWindows, periodDays, validatePeriod } from './windows';
import { addDays } from './dates';

const span = (from: string, n: number) => addDays(from, n - 1);

describe('eventWindows', () => {
  it('one window up to 62 days', () => {
    expect(eventWindows('2026-01-01', '2026-01-31')).toEqual([['2026-01-01', '2026-01-31']]);
    expect(eventWindows('2026-01-01', span('2026-01-01', 62))).toHaveLength(1);
  });
  it('63 days is two windows, the second a single day', () => {
    const w = eventWindows('2026-01-01', span('2026-01-01', 63));
    expect(w).toHaveLength(2);
    expect(w[0]).toEqual(['2026-01-01', span('2026-01-01', 62)]);
    expect(w[1][0]).toBe(w[1][1]);
  });
  it('366 days is six windows, no gaps and no overlap, covering exactly the range', () => {
    const to = span('2026-01-01', 366);
    const w = eventWindows('2026-01-01', to);
    expect(w).toHaveLength(6);
    expect(w[0][0]).toBe('2026-01-01');
    expect(w[5][1]).toBe(to);
    for (let i = 1; i < w.length; i++) expect(w[i][0]).toBe(addDays(w[i - 1][1], 1));
    for (const [a, b] of w) expect(periodDays(a, b)).toBeLessThanOrEqual(62);
  });
  it('from after to gives nothing', () => {
    expect(eventWindows('2026-02-01', '2026-01-01')).toEqual([]);
  });
});

describe('validatePeriod', () => {
  it('accepts 366 days inclusive, rejects 367 and reversed ranges', () => {
    expect(validatePeriod('2026-01-01', span('2026-01-01', 366))).toBeNull();
    expect(validatePeriod('2026-01-01', span('2026-01-01', 367))).toBe('Pilih rentang 366 hari atau kurang.');
    expect(validatePeriod('2026-02-01', '2026-01-01')).toBe('Tanggal awal harus sebelum tanggal akhir.');
    expect(validatePeriod('2026-01-01', '2026-01-01')).toBeNull();
  });
  it('periodDays counts both ends', () => {
    expect(periodDays('2026-11-01', '2026-11-02')).toBe(2);
  });
});
